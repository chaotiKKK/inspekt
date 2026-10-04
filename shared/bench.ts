/** Fortschritt einer laufenden Benchmark-Messung. */
export interface BenchProgress {
  /** technischer Schlüssel der aktuellen Messung */
  task: 'float' | 'int' | 'hash' | 'mem' | 'parallel'
  label: string
  /** 0–100 über die gesamte Suite */
  pct: number
  index: number
  total: number
}

/**
 * Ergebnis der Inspekt-Benchmarksuite.
 * Alle Werte sind **gemessen** (Node/V8 auf diesem Rechner), nicht berechnet.
 */
export interface BenchResult {
  at: number
  ms: number
  cores: number
  /** Gleitkomma-Operationen pro Sekunde (Float64) */
  floatFlops: number
  /** Ganzzahl-Operationen pro Sekunde */
  intOps: number
  /** SHA-256-Vorgänge pro Sekunde (je 1 MiB Datensatz) */
  hashPerSec: number
  /** Kopier-Bandbreite in Bytes pro Sekunde */
  memBytesPerSec: number
  /** Gleitkomma-Durchsatz über alle Kerne gleichzeitig */
  parallelFlops: number
  /** Zusammengesetzter Inspekt-Score, siehe computeScore() */
  score: number
}

export const BENCH_TOTAL = 5

/**
 * Inspekt-Score: geometrisches Mittel der vier Einzelwerte relativ zu
 * festen Baselines (1 GFLOPS, 1 GOps/s, 1.000 SHA-256/s, 10 GB/s), mal 100.
 * Die Baselines stehen in der UI, damit der Wert nachvollziehbar bleibt.
 */
export const SCORE_BASELINE = { float: 1e9, int: 1e9, hash: 1e3, mem: 10 * 1024 ** 3 } as const

export function computeScore(input: {
  floatFlops: number
  intOps: number
  hashPerSec: number
  memBytesPerSec: number
}): number {
  const ratios = [
    input.floatFlops / SCORE_BASELINE.float,
    input.intOps / SCORE_BASELINE.int,
    input.hashPerSec / SCORE_BASELINE.hash,
    input.memBytesPerSec / SCORE_BASELINE.mem,
  ].map((r) => (Number.isFinite(r) && r > 0 ? r : 1e-6))
  const geometric = Math.exp(ratios.reduce((sum, r) => sum + Math.log(r), 0) / ratios.length)
  return Math.round(geometric * 100)
}
