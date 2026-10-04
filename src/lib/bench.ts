import { useSyncExternalStore } from 'react'
import type { BenchProgress, BenchResult } from '../../shared/bench.ts'

export interface BenchState {
  running: boolean
  progress: BenchProgress | null
  result: BenchResult | null
  error: string | null
  /** alle bisherigen Läufe, aufsteigend nach Zeitpunkt */
  history: BenchResult[]
}

const initial: BenchState = { running: false, progress: null, result: null, error: null, history: [] }
let state: BenchState = initial
let cancelRequested = false
const listeners = new Set<() => void>()

function set(patch: Partial<BenchState>): void {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useBench(): BenchState {
  return useSyncExternalStore(subscribe, () => state, () => initial)
}

/** Lädt die gespeicherte Historie einmalig und hängt sich an Änderungen. */
export function initBenchHistory(): () => void {
  const api = window.inspekt
  if (!api) return () => undefined
  void api
    .benchHistory()
    .then((history) => set({ history }))
    .catch(() => undefined)
  return api.onBenchHistoryChanged((history) => set({ history }))
}

/** Startet die Messsuite; der Fortschritt läuft als Event vom Hauptprozess herein. */
export async function runBench(): Promise<void> {
  if (state.running) return
  const api = window.inspekt
  if (!api) {
    set({ error: 'Keine Verbindung zum Hauptprozess.' })
    return
  }

  cancelRequested = false
  set({ running: true, progress: null, error: null })
  const off = api.onBenchProgress((progress) => set({ progress }))

  try {
    const result = await api.benchRun()
    set({ running: false, progress: null, result })
  } catch (err) {
    set({
      running: false,
      progress: null,
      error: cancelRequested ? 'Benchmark abgebrochen.' : err instanceof Error ? err.message : String(err),
    })
  } finally {
    cancelRequested = false
    off()
  }
}

export async function cancelBench(): Promise<void> {
  if (!state.running) return
  cancelRequested = true
  await window.inspekt?.benchCancel()
}

export async function clearBenchHistory(): Promise<void> {
  await window.inspekt?.benchHistoryClear()
  set({ history: [] })
}