import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppInfo } from '../../shared/api.ts'
import type { Snapshot, Telemetry } from '../../shared/schema.ts'

const bridge = (): typeof window.inspekt | null => (typeof window !== 'undefined' && window.inspekt ? window.inspekt : null)

export interface SnapshotState {
  snapshot: Snapshot | null
  loading: boolean
  progress: string[]
  error: string | null
  elevated: boolean | null
  refresh: () => Promise<void>
  refreshSections: (names: string[]) => Promise<void>
  lastUpdate: number | null
}

export function useSnapshot(): SnapshotState {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [elevated, setElevated] = useState<boolean | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    const api = bridge()
    if (!api || busy.current) return
    busy.current = true
    setLoading(true)
    setError(null)
    setProgress([])
    const off = api.onProgress((section) => setProgress((prev) => (prev.includes(section) ? prev : [...prev, section])))
    try {
      const next = await api.collect()
      setSnapshot(next)
      setLastUpdate(Date.now())
      setElevated(next.elevated === true)
    } catch (err) {
      setError((err as Error).message || String(err))
    } finally {
      off()
      busy.current = false
      setLoading(false)
    }
  }, [])

  const refreshSections = useCallback(async (names: string[]) => {
    const api = bridge()
    if (!api || busy.current || names.length === 0) return
    busy.current = true
    setLoading(true)
    try {
      const partial = (await api.sections(names)) as Partial<Snapshot['sections']>
      setSnapshot((prev) => (prev ? { ...prev, sections: { ...prev.sections, ...partial } } : prev))
      setLastUpdate(Date.now())
    } catch (err) {
      setError((err as Error).message || String(err))
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const api = bridge()
    if (!api) {
      setError('Keine Verbindung zur Anwendung (preload fehlt).')
      return
    }
    void api.isElevated().then(setElevated).catch(() => setElevated(null))
    void refresh()
  }, [refresh])

  return { snapshot, loading, progress, error, elevated, refresh, refreshSections, lastUpdate }
}

export interface TelemetryState {
  tick: Telemetry | null
  history: Telemetry[]
  error: string | null
}

const HISTORY_MAX = 160

export function useTelemetry(enabled: boolean): TelemetryState {
  const [tick, setTick] = useState<Telemetry | null>(null)
  const [history, setHistory] = useState<Telemetry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const api = bridge()
    if (!api || !enabled) return

    const offTick = api.onTelemetry((next) => {
      setTick(next)
      setHistory((prev) => (prev.length >= HISTORY_MAX ? [...prev.slice(-(HISTORY_MAX - 1)), next] : [...prev, next]))
    })
    const offError = api.onTelemetryError((message) => setError(message))
    void api.telemetryStart()

    return () => {
      offTick()
      offError()
      void api.telemetryStop()
    }
  }, [enabled])

  return { tick, history, error }
}

export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    const api = bridge()
    if (!api) return
    void api
      .info()
      .then(setInfo)
      .catch(() => setInfo(null))
  }, [])
  return info
}
