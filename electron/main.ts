import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import collectScriptRaw from './collector/collect.ps1?raw'
import telemetryScriptRaw from './collector/telemetry.ps1?raw'
import { collect, collectSectionSnapshot, isElevated, startTelemetry, type TelemetryStream } from '../node/collect.ts'
import { startBench, type BenchHandle } from '../node/bench.ts'
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
      return await collect({ scriptPath: collectorPath('collect.ps1'), onSection })
    } catch (err) {
      if (!isMissingScript(err)) throw err
      // the script disappeared between resolution and launch – rewrite and retry once
      return await collect({ scriptPath: collectorPath('collect.ps1'), onSection })
    }
  })

  ipcMain.handle('hw:sections', async (_event, names: string[]) => {
    if (!Array.isArray(names) || names.length === 0) throw new Error('mindestens eine Sektion anfordern')
    try {
      return await collectSectionSnapshot(collectorPath('collect.ps1'), names)
    } catch (err) {
      if (!isMissingScript(err)) throw err
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
