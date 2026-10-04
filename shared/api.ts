import type { BenchProgress, BenchResult } from './bench.ts'
import type { SnapshotDiff } from './diff.ts'
import type { NetScanProgress, NetScanResult } from './net.ts'
import type { Snapshot, Telemetry } from './schema.ts'

/** Referenz-Erfassung für den Vergleich. */
export interface SnapshotEntry {
  id: string
  label: string
  createdAt: number
  collectedAt: string
  system: string
  fehlerhaft: string[]
}

export interface AppInfo {
  version: string
  packaged: boolean
  platform: string
  arch: string
  locale: string
  userData: string
  exe: string
}

export interface ExportPayload {
  format: 'json' | 'csv' | 'html'
  content: string
  defaultName?: string
}

export interface ExportResult {
  canceled: boolean
  filePath: string | null
  mime: string | null
}

/**
 * The bridge exposed by the preload script as `window.inspekt`.
 */
/** Protokolleintrag des Hauptprozesses (Ringpuffer, bleibt lokal). */
export interface LogEntry {
  at: number
  level: 'info' | 'warn' | 'error'
  quelle: string
  text: string
}

export interface InspektApi {
  collect: () => Promise<Snapshot>
  sections: (names: string[]) => Promise<Record<string, unknown>>
  onProgress: (callback: (section: string) => void) => () => void
  telemetryStart: () => Promise<boolean>
  telemetryStop: () => Promise<void>
  onTelemetry: (callback: (tick: Telemetry) => void) => () => void
  onTelemetryError: (callback: (message: string) => void) => () => void
  isElevated: () => Promise<boolean>
  relaunchElevated: () => Promise<{ requested: boolean; error?: string }>
  info: () => Promise<AppInfo>
  export: (payload: ExportPayload) => Promise<ExportResult>
  benchRun: () => Promise<BenchResult>
  benchCancel: () => Promise<boolean>
  benchHistory: () => Promise<BenchResult[]>
  benchHistoryClear: () => Promise<boolean>
  onBenchProgress: (callback: (progress: BenchProgress) => void) => () => void
  onBenchHistoryChanged: (callback: (history: BenchResult[]) => void) => () => void
  openExternal: (url: string) => Promise<boolean>
  snapshotList: () => Promise<SnapshotEntry[]>
  snapshotSave: (label: string) => Promise<SnapshotEntry>
  snapshotDelete: (id: string) => Promise<boolean>
  /** frische Erfassung gegen eine gespeicherte Referenz halten */
  snapshotDiff: (id: string) => Promise<SnapshotDiff>
  netScan: () => Promise<NetScanResult>
  netScanCancel: () => Promise<boolean>
  onNetScanProgress: (callback: (progress: NetScanProgress) => void) => () => void
  logList: (limit?: number) => Promise<LogEntry[]>
  /** kopierfertiger Diagnoseblock für Fehlerberichte */
  diagBlock: (snapshot: unknown) => Promise<string>
  platform: string
}
