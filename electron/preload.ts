import { contextBridge, ipcRenderer } from 'electron'
import type { ExportPayload, InspektApi } from '../shared/api.ts'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => {
    callback(payload)
  }
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: InspektApi = {
  collect: () => ipcRenderer.invoke('hw:collect'),
  sections: (names: string[]) => ipcRenderer.invoke('hw:sections', names),
  onProgress: (callback: (section: string) => void) => subscribe('hw:progress', callback),
  telemetryStart: () => ipcRenderer.invoke('hw:telemetryStart'),
  telemetryStop: () => ipcRenderer.invoke('hw:telemetryStop'),
  onTelemetry: (callback) => subscribe('hw:telemetry', callback),
  onTelemetryError: (callback) => subscribe('hw:telemetryError', callback),
  isElevated: () => ipcRenderer.invoke('sys:isElevated'),
  relaunchElevated: () => ipcRenderer.invoke('sys:relaunchElevated'),
  info: () => ipcRenderer.invoke('sys:info'),
  export: (payload: ExportPayload) => ipcRenderer.invoke('hw:export', payload),
  benchRun: () => ipcRenderer.invoke('bench:run'),
  benchCancel: () => ipcRenderer.invoke('bench:cancel'),
  benchHistory: () => ipcRenderer.invoke('bench:history'),
  benchHistoryClear: () => ipcRenderer.invoke('bench:historyClear'),
  onBenchProgress: (callback) => subscribe('bench:progress', callback),
  onBenchHistoryChanged: (callback) => subscribe('bench:historyChanged', callback),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  platform: process.platform,
}

contextBridge.exposeInMainWorld('inspekt', api)
