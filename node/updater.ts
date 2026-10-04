import { autoUpdater, type UpdateDownloadedEvent, type UpdateInfo as UpdaterReleaseInfo } from 'electron-updater'
import { logInfo, logWarn } from '../node/log.ts'

/** Was die Oberfläche vom Update-Zustand zu sehen bekommt. */
export interface UpdateInfo {
  /** die neueste verfügbare Version */
  version: string | null
  note: string | null
  /** Update steht bereit und wird beim Beenden geladen */
  ready: boolean
  fehler: string | null
  /** wird nur gesetzt, wenn wirklich etwas gefunden wurde */
  verfuegbar: boolean
}

type ProgressInfo = { percent: number }

let zwischenstand: UpdateInfo = {
  version: null,
  note: null,
  ready: false,
  fehler: null,
  verfuegbar: false,
}

function send(win: Electron.BrowserWindow | null): void {
  if (win && !win.isDestroyed()) win.webContents.send('update:state', zwischenstand)
}

/** Release-Notizen können Text oder eine Liste sein – für die Anzeige wird Text genutzt. */
function noteText(notes: unknown): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) {
    const texte = notes
      .map((eintrag) => {
        if (typeof eintrag === 'string') return eintrag
        if (eintrag && typeof eintrag === 'object' && 'body' in eintrag) {
          const koerper = (eintrag as { body?: unknown }).body
          return typeof koerper === 'string' ? koerper : ''
        }
        return ''
      })
      .filter(Boolean)
    return texte.length > 0 ? texte.join('\n\n') : null
  }
  return null
}

export type ReleaseInfo = UpdaterReleaseInfo

export function initAutoUpdater(win: Electron.BrowserWindow | null): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (message: string) => logInfo('updater', message),
    warn: (message: string) => logWarn('updater', message),
    error: (message: string) => logWarn('updater', message),
    debug: () => undefined,
  }

  autoUpdater.on('update-available', (info: ReleaseInfo) => {
    zwischenstand = {
      version: info.version,
      note: noteText(info.releaseNotes),
      ready: false,
      fehler: null,
      verfuegbar: true,
    }
    logInfo('updater', `Update verfügbar: ${info.version}`)
    send(win)
  })

  autoUpdater.on('update-not-available', () => {
    zwischenstand = { ...zwischenstand, version: null, fehler: null, verfuegbar: false }
    logInfo('updater', 'Kein Update verfügbar – installierte Version ist aktuell')
    send(win)
  })

  autoUpdater.on('download-progress', (p: ProgressInfo) => {
    zwischenstand = { ...zwischenstand, ready: false }
    if (p.percent >= 99) logInfo('updater', 'Download fast fertig')
    send(win)
  })

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    zwischenstand = { ...zwischenstand, version: info.version, ready: true, verfuegbar: true }
    logInfo('updater', `Update ${info.version} geladen, startet beim Beenden`)
    send(win)
  })

  autoUpdater.on('error', (err: Error) => {
    // Ohne Netzverbindung, ohne veröffentlichtes Release oder im
    // Entwicklungsmodus ist das kein Fehler des Nutzers, sondern der Zustand.
    zwischenstand = { ...zwischenstand, fehler: err.message, verfuegbar: false, ready: false }
    logWarn('updater', `Prüfung nicht möglich: ${err.message}`)
    send(win)
  })
}

export async function checkForUpdates(win: Electron.BrowserWindow | null): Promise<UpdateInfo> {
  zwischenstand = { version: null, note: null, ready: false, fehler: null, verfuegbar: false }
  send(win)
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    zwischenstand = {
      ...zwischenstand,
      fehler: err instanceof Error ? err.message : String(err),
    }
    send(win)
  }
  return zwischenstand
}

export function quitAndInstall(win: Electron.BrowserWindow | null): boolean {
  if (!zwischenstand.ready) return false
  logInfo('updater', 'Benutzer startet das Update jetzt')
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true)
    win?.destroy()
  })
  return true
}