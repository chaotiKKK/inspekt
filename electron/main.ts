import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import collectScriptRaw from './collector/collect.ps1?raw'
import telemetryScriptRaw from './collector/telemetry.ps1?raw'
import { collect, collectSectionSnapshot, isElevated, startTelemetry, type TelemetryStream } from '../node/collect.ts'
import { diffSnapshots } from '../shared/diff.ts'
import { logError, logEntries, logInfo, logStats, logText, logWarn } from '../node/log.ts'
import type { Snapshot } from '../shared/schema.ts'
import { startBench, type BenchHandle } from '../node/bench.ts'
import { scanLan, type LanDevice } from '../node/net-scan.ts'
import type { BenchResult } from '../shared/bench.ts'

// ---------------------------------------------------------------------------
// paths
// ---------------------------------------------------------------------------

/**
 * The portable build unpacks into %TEMP%, which is wiped and rewritten by the
 * launcher, by cleanup tools and by antivirus. The scripts are therefore always
 * available as an inlined copy and are materialised into userData before use.
 */
const EMBEDDED: Record<string, string> = {
  'collect.ps1': collectScriptRaw,
  'telemetry.ps1': telemetryScriptRaw,
}

function readShipped(fileName: string): string | null {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, fileName)]
    : [path.join(app.getAppPath(), 'electron', 'collector', fileName), path.join(process.cwd(), 'electron', 'collector', fileName)]
  for (const candidate of candidates) {
    try {
      if (!fsSync.existsSync(candidate)) continue
      const text = fsSync.readFileSync(candidate, 'utf8')
      if (text.length > 100) return text
    } catch {
      continue
    }
  }
  return null
}

function materialize(fileName: string, content: string): string {
  const target = path.join(app.getPath('userData'), 'collector', fileName)
  try {
    fsSync.mkdirSync(path.dirname(target), { recursive: true })
    if (!fsSync.existsSync(target) || fsSync.readFileSync(target, 'utf8') !== content) {
      fsSync.writeFileSync(target, content, 'utf8')
    }
  } catch {
    /* keep whatever is there */
  }
  return target
}

function collectorPath(fileName: string): string {
  const content = readShipped(fileName) ?? EMBEDDED[fileName] ?? ''
  if (!app.isPackaged) {
    const devPath = path.join(app.getAppPath(), 'electron', 'collector', fileName)
    if (fsSync.existsSync(devPath)) return devPath
  }
  const target = materialize(fileName, content)
  if (fsSync.existsSync(target) && fsSync.statSync(target).size > 0) return target
  // last resort: the embedded copy, written once more
  return materialize(fileName, EMBEDDED[fileName] ?? content)
}

/** PowerShell exits with this when the -File argument vanished mid-flight. */
function isMissingScript(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /nicht vorhanden|does not exist|cannot find|the system cannot find|ENOENT/i.test(message)
}

// ---------------------------------------------------------------------------
// Referenz-Snapshots für den Vergleich
// ---------------------------------------------------------------------------

export interface SnapshotEntry {
  id: string
  label: string
  createdAt: number
  collectedAt: string
  system: string
  /** Anzahl fehlerhafter Bereiche zum Zeitpunkt der Erfassung */
  fehlerhaft: string[]
}

const SNAPSHOT_LIMIT = 20

function snapshotDir(): string {
  return path.join(app.getPath('userData'), 'snapshots')
}

function snapshotFile(id: string): string {
  return path.join(snapshotDir(), `${id}.json`)
}

/** Dateinamen auf sichere Form bringen, damit nichts aus dem Label in den Pfad wandert. */
function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
}

function fileStampISO(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function readEntry(id: string): SnapshotEntry | null {
  try {
    const raw = fsSync.readFileSync(snapshotFile(id), 'utf8')
    const parsed = JSON.parse(raw) as { entry?: SnapshotEntry }
    return parsed.entry ?? null
  } catch {
    return null
  }
}

async function listSnapshots(): Promise<SnapshotEntry[]> {
  let files: string[] = []
  try {
    files = (await fs.readdir(snapshotDir())).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  const entries: SnapshotEntry[] = []
  for (const file of files) {
    const entry = readEntry(path.basename(file, '.json'))
    if (entry) entries.push(entry)
  }
  return entries.sort((a, b) => b.createdAt - a.createdAt)
}

/** Alte Einträge entfernen, damit das Verzeichnis nicht unbegrenzt wächst. */
async function pruneSnapshots(): Promise<void> {
  const entries = await listSnapshots()
  for (const entry of entries.slice(SNAPSHOT_LIMIT)) {
    try {
      await fs.unlink(snapshotFile(entry.id))
    } catch {
      /* egal, wird beim nächsten Mal versucht */
    }
  }
}

// ---------------------------------------------------------------------------
// window
// ---------------------------------------------------------------------------

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: '#0b0f14',
    title: 'Inspekt',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => {
    win = null
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// ---------------------------------------------------------------------------
// elevation
// ---------------------------------------------------------------------------

function quote(arg: string): string {
  return `'${arg.replace(/'/g, "''")}'`
}

function relaunchElevated(): { requested: boolean; error?: string } {
  const exe = process.execPath
  const args = app.isPackaged ? [] : process.argv.slice(1)
  const argList = args.map(quote).join(',')
  const argPart = argList ? ` -ArgumentList @(${argList})` : ''
  const command = `Start-Process -FilePath ${quote(exe)}${argPart} -Verb RunAs`

  try {
    const psExe = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    const child = spawn(psExe, ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true,
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    return { requested: true }
  } catch (err) {
    return { requested: false, error: (err as Error).message }
  }
}

// ---------------------------------------------------------------------------
// telemetry
// ---------------------------------------------------------------------------

let telemetry: TelemetryStream | null = null
let bench: BenchHandle | null = null
let netScan: { handle: Promise<unknown>; signal: { aborted: boolean } } | null = null

// ---------------------------------------------------------------------------
// Benchmark-Historie (liegt neben den Collector-Skripten im Benutzerprofil)
// ---------------------------------------------------------------------------

const HISTORY_LIMIT = 60

function historyPath(): string {
  return path.join(app.getPath('userData'), 'bench-history.json')
}

async function readHistory(): Promise<BenchResult[]> {
  try {
    const raw = await fs.readFile(historyPath(), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e): e is BenchResult => Boolean(e) && typeof (e as BenchResult).score === 'number')
  } catch {
    return []
  }
}

async function writeHistory(entries: BenchResult[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(historyPath()), { recursive: true })
    await fs.writeFile(historyPath(), `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
  } catch {
    /* Historie ist optional - ein Schreibfehler darf den Benchmark nicht kippen */
  }
}

/** Hängt einen Lauf an und beschneidet auf die letzten HISTORY_LIMIT Einträge. */
async function appendHistory(result: BenchResult): Promise<void> {
  const entries = await readHistory()
  entries.push(result)
  const trimmed = entries.slice(-HISTORY_LIMIT)
  await writeHistory(trimmed)
  if (!win?.isDestroyed()) win?.webContents.send('bench:historyChanged', trimmed)
}

function send(channel: string, payload: unknown): void {
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
}

// ---------------------------------------------------------------------------
// ipc
// ---------------------------------------------------------------------------

function registerIpc(): void {
  ipcMain.handle('hw:collect', async (event) => {
    const onSection = (name: string): void => {
      if (!event.sender.isDestroyed()) event.sender.send('hw:progress', name)
    }
    try {
      const snapshot = await collect({ scriptPath: collectorPath('collect.ps1'), onSection })
      const fehler = Object.entries(snapshot.sections).filter(([, s]) => !s.ok)
      logInfo('collect', `${Object.keys(snapshot.sections).length} Bereiche in ${snapshot.totalMs} ms, ${fehler.length} mit Fehler`)
      for (const [name, s] of fehler) logWarn('collect', `${name}: ${s.error ?? 'unbekannt'}`)
      return snapshot
    } catch (err) {
      if (!isMissingScript(err)) {
        logError('collect', err instanceof Error ? err.message : String(err))
        throw err
      }
      logWarn('collect', 'Skript fehlte beim Start, wird neu geschrieben und erneut versucht')
      return await collect({ scriptPath: collectorPath('collect.ps1'), onSection })
    }
  })

  ipcMain.handle('hw:sections', async (_event, names: string[]) => {
    if (!Array.isArray(names) || names.length === 0) throw new Error('mindestens eine Sektion anfordern')
    try {
      return await collectSectionSnapshot(collectorPath('collect.ps1'), names)
    } catch (err) {
      if (!isMissingScript(err)) {
        logError('sections', `${names.join(',')}: ${err instanceof Error ? err.message : String(err)}`)
        throw err
      }
      logWarn('sections', `${names.join(',')}: Skript fehlte, wird neu geschrieben`)
      return await collectSectionSnapshot(collectorPath('collect.ps1'), names)
    }
  })

  ipcMain.handle('hw:telemetryStart', async () => {
    telemetry?.stop()
    telemetry = startTelemetry(
      collectorPath('telemetry.ps1'),
      (tick) => send('hw:telemetry', tick),
      (message) => send('hw:telemetryError', message),
    )
    return true
  })

  ipcMain.handle('hw:telemetryStop', () => {
    telemetry?.stop()
    telemetry = null
    return true
  })

  ipcMain.handle('snapshot:list', () => listSnapshots())

  ipcMain.handle('snapshot:save', async (_event, label: string) => {
    const clean = String(label ?? '').trim().slice(0, 60) || 'Referenz'
    const snapshot = await collect({ scriptPath: collectorPath('collect.ps1') })
    const id = `${fileStampISO(Date.now())}-${safeId(clean).slice(0, 12)}`
    const entry: SnapshotEntry = {
      id,
      label: clean,
      createdAt: Date.now(),
      collectedAt: snapshot.collectedAt,
      system: `${snapshot.sections.system.data?.manufacturer ?? ''} ${snapshot.sections.system.data?.model ?? ''}`.trim() || 'unbekanntes System',
      fehlerhaft: Object.entries(snapshot.sections)
        .filter(([, s]) => !s.ok)
        .map(([name]) => name),
    }
    await fs.mkdir(snapshotDir(), { recursive: true })
    await fs.writeFile(snapshotFile(id), `${JSON.stringify({ entry, snapshot }, null, 2)}\n`, 'utf8')
    await pruneSnapshots()
    return entry
  })

  ipcMain.handle('snapshot:load', async (_event, id: string) => {
    const file = snapshotFile(String(id ?? ''))
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw) as { entry?: SnapshotEntry; snapshot?: unknown }
    if (!parsed.snapshot) throw new Error('Referenz enthält keinen Snapshot.')
    return { entry: parsed.entry ?? null, snapshot: parsed.snapshot }
  })

  ipcMain.handle('snapshot:delete', async (_event, id: string) => {
    try {
      await fs.unlink(snapshotFile(String(id ?? '')))
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('snapshot:diff', async (_event, id: string) => {
    const file = snapshotFile(String(id ?? ''))
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw) as { snapshot?: unknown }
    if (!parsed.snapshot) throw new Error('Referenz enthält keinen Snapshot.')
    const aktuell = await collect({ scriptPath: collectorPath('collect.ps1') })
    return diffSnapshots(parsed.snapshot as Snapshot, aktuell)
  })

  ipcMain.handle('net:scan', async (event) => {
    if (netScan) throw new Error('Ein Suchlauf läuft bereits.')
    const signal = { aborted: false }
    const found: LanDevice[] = []
    const handle = scanLan({
      signal,
      onProgress: (done, total) => {
        if (!event.sender.isDestroyed()) event.sender.send('net:scanProgress', { done, total, found: found.length })
      },
    })
    netScan = { handle, signal }
    try {
      const result = await handle
      return result
    } finally {
      netScan = null
    }
  })

  ipcMain.handle('net:scanCancel', () => {
    if (!netScan) return false
    netScan.signal.aborted = true
    netScan = null
    return true
  })

  // Externe Links laufen immer ueber den Hauptprozess, damit im Renderer
  // kein Fenster entsteht. Nur http(s) ist erlaubt.
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle('sys:isElevated', () => isElevated())

  ipcMain.handle('bench:run', async (event) => {
    if (bench) throw new Error('Ein Benchmark läuft bereits.')
    const handle = startBench((progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('bench:progress', progress)
    })
    bench = handle
    try {
      const result = await handle.promise
      await appendHistory(result)
      return result
    } finally {
      bench = null
    }
  })

  ipcMain.handle('bench:history', () => readHistory())

  ipcMain.handle('bench:historyClear', async () => {
    await writeHistory([])
    return true
  })

  ipcMain.handle('bench:cancel', () => {
    bench?.cancel()
    bench = null
    return true
  })

  ipcMain.handle('sys:relaunchElevated', () => {
    const result = relaunchElevated()
    if (result.requested) setTimeout(() => app.quit(), 400)
    return result
  })

  ipcMain.handle('sys:info', () => ({
    version: app.getVersion(),
    packaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
    locale: app.getLocale(),
    userData: app.getPath('userData'),
    exe: process.execPath,
  }))

  ipcMain.handle('log:list', (_event, limit?: number) => logEntries(typeof limit === 'number' ? limit : 200))

  // Bündelt alles, was für einen Fehlerbericht nützlich ist – inklusive der
  // letzten Protokollzeilen. Bewusst als Text zum Kopieren gedacht.
  ipcMain.handle('diag:block', async (_event, snapshot: unknown) => {
    const teile: string[] = []
    teile.push(`Inspekt ${app.getVersion()} (${app.isPackaged ? 'installiert' : 'Entwicklung'})`)
    teile.push(`Plattform: ${process.platform} ${process.arch} · Node ${process.versions.node} · Electron ${process.versions.electron}`)
    teile.push(`Sprache: ${app.getLocale()} · Benutzerrechte: ${(await isElevated()) ? 'erhöht' : 'Standard'}`)
    teile.push(`Speicherort: ${app.getPath('userData')}`)
    teile.push(`Startbild: ${process.execPath}`)

    const rohdaten = snapshot as { psVersion?: string; collectedAt?: string; sections?: Record<string, { ok: boolean; ms?: number; error?: string }> } | null
    if (rohdaten?.psVersion) teile.push(`PowerShell: ${rohdaten.psVersion}`)
    if (rohdaten?.collectedAt) teile.push(`Erfassung: ${rohdaten.collectedAt}`)
    const fehler = Object.entries(rohdaten?.sections ?? {})
      .filter(([, s]) => !s.ok)
      .map(([name, s]) => `${name}: ${s.error ?? 'unbekannt'}`)
    teile.push(`Bereiche mit Fehlern: ${fehler.length === 0 ? 'keine' : fehler.join(' | ')}`)

    const schnitte = Object.entries(rohdaten?.sections ?? {})
      .map(([name, s]) => `${name}=${s.ok ? `${s.ms ?? '?'} ms` : 'fehler'}`)
      .join(' ')
    if (schnitte) teile.push(`Laufzeiten: ${schnitte}`)

    const stats = logStats()
    teile.push(`Protokoll: ${stats.gesamt} Einträge, ${stats.warnungen} Warnungen, ${stats.fehler} Fehler`)
    teile.push('')
    teile.push('--- letzte Protokollzeilen ---')
    teile.push(logText(40))
    return teile.join('\n')
  })

  ipcMain.handle(
    'hw:export',
    async (_event, payload: { format: 'json' | 'csv' | 'html'; content: string; defaultName?: string }) => {
      const ext = payload.format === 'csv' ? '.csv' : payload.format === 'html' ? '.html' : '.json'
      const mime = payload.format === 'csv' ? 'text/csv' : payload.format === 'html' ? 'text/html' : 'application/json'
      const options: Electron.SaveDialogOptions = {
        title: 'Bericht speichern',
        defaultPath: `${payload.defaultName ?? 'inspekt-report'}${ext}`,
        filters: [{ name: payload.format.toUpperCase(), extensions: [ext.slice(1)] }],
      }
      const { canceled, filePath } =
        win && !win.isDestroyed() ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
      if (canceled || !filePath) return { canceled: true, filePath: null, mime: null }
      await fs.writeFile(filePath, payload.content, 'utf8')
      shell.showItemInFolder(filePath)
      return { canceled: false, filePath, mime }
    },
  )
}

// ---------------------------------------------------------------------------
// lifecycle
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  void app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('de.inspekt.app')
    registerIpc()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    telemetry?.stop()
    telemetry = null
  })
}
