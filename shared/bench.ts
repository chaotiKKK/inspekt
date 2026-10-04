/** Fortschritt einer laufenden Benchmark-Messung. */
export interface BenchProgress {
  /** technischer Schlüssel der aktuellen Messung */
  task: 'float' | 'int' | 'hash' | 'mem' | 'latency' | 'parallel'
  label: string
  /** 0–100 über die gesamte Suite */
  pct: number
  index: number
  total: number
}

/** Latenz einer Zufallssuche bei einem bestimmten Arbeitsset. */
export interface BenchLatency {
  /** Größe des Arbeitssets in Bytes */
  bytes: number
  /** mittlere Zugriffsdauer in Nanosekunden */
  ns: number
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
  /** Gleitkomma-Durchsatz über alle Kerne gleichzeitig */
  parallelFlops: number
  /** Kopier-Bandbreite in Bytes pro Sekunde */
  memBytesPerSec: number
  /** Schreibbandbreite (Puffer füllen), Bytes pro Sekunde */
  memWriteBytesPerSec?: number | null
  /** Lesbandbreite (Puffer traversieren), Bytes pro Sekunde */
  memReadBytesPerSec?: number | null
  /** Kopierbandbreite, Bytes pro Sekunde – identisch zu memBytesPerSec */
  memCopyBytesPerSec?: number | null
  /** Zufallslatenz bei wachsendem Arbeitsset: L1 → L2 → L3 → RAM */
  latency?: BenchLatency[]
  /**
   * Mittlere Systemlast während der Messung in Watt.
   * Nur belastbar, wenn ein Akku die Entladeleistung meldet (Notebooks);
   * auf Desktop-PCs bleibt das null, statt etwas zu erfinden.
   */
  powerWatts?: number | null
  /** woher die Leistungsangabe stammt: Akkuentladung oder Akkuladung */
  powerSource?: 'entladung' | 'ladung' | null
  /** Gleitkomma-Operationen pro Watt, nur wenn powerWatts bekannt */
  gflopsPerWatt?: number | null
  /** Zusammengesetzter Inspekt-Score, siehe computeScore() */
  score: number
}

export const BENCH_TOTAL = 6

/** Arbeitssets für den Latenz-Sweep: L1, L2, L3, Hauptspeicher. */
export const LATENCY_SIZES = [4 * 1024, 256 * 1024, 8 * 1024 ** 2, 64 * 1024 ** 2] as const

export function latencyTier(bytes: number): string {
  if (bytes <= 4 * 1024) return 'L1-Bereich (4 KiB)'
  if (bytes <= 256 * 1024) return 'L2-Bereich (256 KiB)'
  if (bytes <= 8 * 1024 ** 2) return 'L3-Bereich (8 MiB)'
  return 'Arbeitsspeicher (64 MiB)'
}

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