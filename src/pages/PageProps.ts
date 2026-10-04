import type { Snapshot, Telemetry } from '../../shared/schema.ts'
import type { Settings } from '../lib/settings.ts'
import type { PortReport } from '../lib/ports.ts'

export interface TelemetryView {
  tick: Telemetry | null
  history: Telemetry[]
  error: string | null
}

export interface PageProps {
  snapshot: Snapshot | null
  loading: boolean
  report: PortReport
  telemetry: TelemetryView
  elevated: boolean | null
  onElevate: () => void
  settings: Settings
  patchSettings: (patch: Partial<Settings>) => void
}
