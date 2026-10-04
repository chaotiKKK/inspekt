import os from 'node:os'
import { Worker } from 'node:worker_threads'
import { computeScore, LATENCY_SIZES, type BenchLatency, type BenchProgress, type BenchResult } from '../shared/bench.ts'
import { powershellExe } from './collect.ts'

// ---------------------------------------------------------------------------
// Quelltexte der Worker (eval, damit keine separate Datei gebündelt werden muss)
// ---------------------------------------------------------------------------

/** Einzelner Gleitkomma-Loop – wird auch für die Multi-Core-Messung genutzt. */
const FLOAT_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const ms = (workerData && workerData.ms) || 700
const now = () => Number(process.hrtime.bigint()) / 1e6

function runFloat(durationMs) {
  const n = 16384
  const a = new Float64Array(n)
  const b = new Float64Array(n)
  for (let i = 0; i < n; i++) { a[i] = i * 0.5 + 1; b[i] = i * 0.25 + 2 }
  let acc = 0
  let ops = 0
  const t0 = now()
  for (;;) {
    for (let r = 0; r < 32; r++) {
      for (let i = 0; i < n; i++) {
        const x = a[i] * 1.37 + b[i]
        const y = b[i] - a[i] * 0.11
        a[i] = x
        b[i] = y
      }
      ops += n * 4
      acc += a[r & 16383] + b[(r * 7) & 16383]
    }
    const t = now()
    if (t - t0 >= durationMs) return { value: ops / ((t - t0) / 1000), guard: acc }
  }
}

const out = runFloat(ms)
parentPort.postMessage({ type: 'done', value: out.value, guard: out.guard })
`

const SUITE_SOURCE = `
const { parentPort, workerData, Worker } = require('node:worker_threads')
const os = require('node:os')
const crypto = require('node:crypto')

const floatSource = workerData.floatSource
const cores = Math.max(1, workerData.cores || 1)
const now = () => Number(process.hrtime.bigint()) / 1e6

const PLAN = [
  { task: 'float', label: 'Gleitkomma (Float64)', ms: 800, base: 0, share: 20 },
  { task: 'int', label: 'Ganzzahl (int32)', ms: 700, base: 20, share: 16 },
  { task: 'hash', label: 'SHA-256', ms: 700, base: 36, share: 16 },
  { task: 'mem', label: 'Speicherbandbreite', ms: 800, base: 52, share: 18 },
  { task: 'latency', label: 'Latenz (Cache-Hierarchie)', ms: 800, base: 70, share: 15 },
  { task: 'parallel', label: 'Alle Kerne', ms: 700, base: 85, share: 14 }
]

function report(index, within) {
  const step = PLAN[index]
  const pct = step.base + step.share * Math.max(0, Math.min(1, within))
  parentPort.postMessage({ type: 'progress', task: step.task, label: step.label, pct: Math.min(99, pct) })
}

function runFloat(durationMs, tick) {
  const n = 16384
  const a = new Float64Array(n)
  const b = new Float64Array(n)
  for (let i = 0; i < n; i++) { a[i] = i * 0.5 + 1; b[i] = i * 0.25 + 2 }
  let acc = 0
  let ops = 0
  const t0 = now()
  let mark = t0
  for (;;) {
    for (let r = 0; r < 32; r++) {
      for (let i = 0; i < n; i++) {
        const x = a[i] * 1.37 + b[i]
        const y = b[i] - a[i] * 0.11
        a[i] = x
        b[i] = y
      }
      ops += n * 4
      acc += a[r & 16383] + b[(r * 7) & 16383]
    }
    const t = now()
    if (t - t0 >= durationMs) return { value: ops / ((t - t0) / 1000), guard: acc }
    if (t - mark >= 80) { tick((t - t0) / durationMs); mark = t }
  }
}

function runInt(durationMs, tick) {
  const n = 16384
  const a = new Int32Array(n)
  const b = new Int32Array(n)
  for (let i = 0; i < n; i++) { a[i] = (i * 1103515245 + 12345) | 0; b[i] = (i * 22695477 + 1) | 0 }
  let acc = 0
  let ops = 0
  const t0 = now()
  let mark = t0
  for (;;) {
    for (let r = 0; r < 32; r++) {
      for (let i = 0; i < n; i++) {
        a[i] = (Math.imul(a[i], 1664525) + b[i]) | 0
        b[i] = ((b[i] ^ a[i]) + 1013904223) | 0
      }
      ops += n * 4
      acc = (acc + a[r & 16383]) | 0
    }
    const t = now()
    if (t - t0 >= durationMs) return { value: ops / ((t - t0) / 1000), guard: acc }
    if (t - mark >= 80) { tick((t - t0) / durationMs); mark = t }
  }
}

function runHash(durationMs, tick) {
  const buf = Buffer.allocUnsafe(1 << 20)
  buf.fill(90)
  let count = 0
  const t0 = now()
  let mark = t0
  for (;;) {
    const hash = crypto.createHash('sha256')
    hash.update(buf)
    hash.digest()
    count++
    const t = now()
    if (t - t0 >= durationMs) {
      const secs = (t - t0) / 1000
      return { value: count / secs, bytes: (count * buf.length) / secs, guard: count }
    }
    if (t - mark >= 80) { tick((t - t0) / durationMs); mark = t }
  }
}

function runMem(durationMs, tick) {
  // getrennte Messung von Schreiben, Lesen und Kopieren
  const size = 48 * 1024 * 1024
  const a = Buffer.allocUnsafe(size)
  const b = Buffer.allocUnsafe(size)
  b.fill(3)
  let written = 0
  let read = 0
  let copied = 0
  let guard = 0
  const t0 = now()
  let mark = t0

  for (;;) {
    b.fill(3, 0, size)
    written += size
    let s = 0
    for (let i = 0; i < size; i += 64) s = (s + a[i]) | 0
    read += size
    guard = (guard + s) | 0
    b.copy(a)
    copied += size

    const t = now()
    const elapsed = (t - t0) / 1000
    if (t - t0 >= durationMs) {
      return { write: written / elapsed, read: read / elapsed, copy: copied / elapsed, guard: guard }
    }
    if (t - mark >= 80) { tick((t - t0) / durationMs); mark = t }
  }
}

function runLatency(sizes, tick) {
  const out = []
  let guard = 0
  for (let s = 0; s < sizes.length; s++) {
    const bytes = sizes[s]
    // Zweierpotenz erzwingen, damit der Zeigersprung ueber & (count - 1) laeuft
    const wanted = Math.max(1024, Math.floor(bytes / 4))
    const count = 1 << Math.floor(Math.log2(wanted))
    const mask = count - 1
    const idx = new Int32Array(count)
    for (let i = 0; i < count; i++) idx[i] = i
    // Fisher-Yates mit xorshift32: echte Zufallspermutation ohne lange
    // Divisionskette, jeder Index wird genau einmal besucht
    let state = (Math.imul(bytes, 2654435761) ^ (count << 3) ^ 2463534242) >>> 0
    const rnd = () => {
      state ^= state << 13; state >>>= 0
      state ^= state >>> 17
      state ^= state << 5; state >>>= 0
      return state
    }
    for (let i = count - 1; i > 0; i--) {
      const j = rnd() % (i + 1)
      const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp
    }

    // Startindex aus der Permutation statt 0 - sonst laeuft der Sprung in einen Fixpunkt
    let p = idx[mask]
    for (let i = 0; i < 20000; i++) p = idx[p & mask]

    let runs = 0
    let ns = 0
    const t0 = now()
    do {
      for (let i = 0; i < 100000; i++) p = idx[p & mask]
      runs++
      ns = ((now() - t0) * 1e6) / (runs * 100000)
    } while (now() - t0 < 30)

    guard = (guard + p) | 0
    out.push({ bytes: bytes, ns: ns })
    tick((s + 1) / sizes.length)
  }
  return { latency: out, guard: guard }
}

function runParallel(durationMs, tick) {
  return new Promise((resolve) => {
    let total = 0
    let finished = 0
    const timer = setInterval(() => tick(0.5), 100)
    for (let i = 0; i < cores; i++) {
      const child = new Worker(floatSource, { eval: true, workerData: { ms: durationMs } })
      child.on('message', (m) => { if (m && m.type === 'done') total += m.value })
      child.on('error', () => { finished++; if (finished === cores) { clearInterval(timer); resolve({ value: total, guard: finished }) } })
      child.on('exit', () => { finished++; if (finished === cores) { clearInterval(timer); resolve({ value: total, guard: finished }) } })
    }
  })
}

;(async () => {
  try {
    const started = Date.now()
    report(0, 0)
    const floatOut = runFloat(PLAN[0].ms, (w) => report(0, w))
    report(1, 0)
    const intOut = runInt(PLAN[1].ms, (w) => report(1, w))
    report(2, 0)
    const hashOut = runHash(PLAN[2].ms, (w) => report(2, w))
    report(3, 0)
    const memOut = runMem(PLAN[3].ms, (w) => report(3, w))
    report(4, 0)
    const latOut = runLatency(workerData.latencySizes, (w) => report(4, w))
    report(5, 0)
    const parOut = await runParallel(PLAN[5].ms, (w) => report(5, w))
    parentPort.postMessage({
      type: 'done',
      result: {
        ms: Date.now() - started,
        floatFlops: floatOut.value,
        intOps: intOut.value,
        hashPerSec: hashOut.value,
        hashBytesPerSec: hashOut.bytes,
        memBytesPerSec: memOut.copy,
        memWriteBytesPerSec: memOut.write,
        memReadBytesPerSec: memOut.read,
        memCopyBytesPerSec: memOut.copy,
        latency: latOut.latency,
        parallelFlops: parOut.value
      }
    })
  } catch (err) {
    parentPort.postMessage({ type: 'error', message: String((err && err.stack) || err) })
  }
})()
`

// ---------------------------------------------------------------------------
// Leistungsaufnahme (nur mit Akku belastbar)
// ---------------------------------------------------------------------------

interface PowerSample {
  watts: number | null
  source: 'entladung' | 'ladung' | null
}

/**
 * Liest die Akkuleistung in Milliwatt. Entladung entspricht direkt der
 * Systemlast; beim Laden ist es die Leistung, die ins Akku fliesst - ein
 * brauchbarer, leicht zu hoch liegender Wert. Fehlt beides, kommt null,
 * damit die Oberfläche "nicht messbar" zeigen kann.
 */
const POWER_SCRIPT = `$b = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $b) { 'null' }
elseif ($b.DischargeRate -gt 0) { "entladung|$($b.DischargeRate)" }
elseif ($b.ChargeRate -gt 0) { "ladung|$($b.ChargeRate)" }
else { 'null' }`

async function samplePowerW(): Promise<PowerSample> {
  const empty: PowerSample = { watts: null, source: null }
  try {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const run = promisify(execFile)
    const { stdout } = await run(
      powershellExe(),
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', POWER_SCRIPT],
      { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 256 },
    )
    const text = stdout.trim()
    if (!text || text === 'null') return empty
    const [mode, rawRate] = text.split('|')
    if (mode !== 'entladung' && mode !== 'ladung') return empty
    const milli = Number(rawRate)
    if (!Number.isFinite(milli) || milli <= 0) return empty
    return { watts: milli / 1000, source: mode }
  } catch {
    return empty
  }
}

// ---------------------------------------------------------------------------
// Start / Abbruch
// ---------------------------------------------------------------------------

const ORDER: BenchProgress['task'][] = ['float', 'int', 'hash', 'mem', 'latency', 'parallel']

export interface BenchHandle {
  promise: Promise<BenchResult>
  cancel: () => void
}

interface WorkerMessage {
  type: 'progress' | 'done' | 'error'
  task?: BenchProgress['task']
  label?: string
  pct?: number
  result?: {
    ms: number
    floatFlops: number
    intOps: number
    hashPerSec: number
    hashBytesPerSec?: number
    memBytesPerSec: number
    memWriteBytesPerSec?: number
    memReadBytesPerSec?: number
    memCopyBytesPerSec?: number
    latency?: BenchLatency[]
    parallelFlops: number
  }
  message?: string
}

/** Startet die Suite. Rückgabe enthält ein Promise und eine Abbruchfunktion. */
export function startBench(onProgress?: (progress: BenchProgress) => void): BenchHandle {
  const started = Date.now()
  let worker: Worker | null = null
  let cancelled = false
  const cores = os.availableParallelism()

  const promise = new Promise<BenchResult>((resolve, reject) => {
    // Leistungsprobe läuft parallel zur Messung, damit sie nichts verfälscht
    let powerBefore: PowerSample | null = null
    const sampleBefore = samplePowerW()
      .then((sample) => {
        powerBefore = sample
      })
      .catch(() => undefined)

    try {
      worker = new Worker(SUITE_SOURCE, {
        eval: true,
        workerData: { floatSource: FLOAT_SOURCE, cores, latencySizes: [...LATENCY_SIZES] },
        resourceLimits: { maxOldGenerationSizeMb: 768 },
      })
    } catch (err) {
      reject(new Error(`Benchmark nicht startbar: ${(err as Error).message}`))
      return
    }

    worker.on('message', (message: WorkerMessage) => {
      if (message.type === 'progress') {
        const index = ORDER.indexOf(message.task ?? 'float')
        onProgress?.({
          task: message.task ?? 'float',
          label: message.label ?? '',
          pct: message.pct ?? 0,
          index: index < 0 ? 0 : index,
          total: ORDER.length,
        })
        return
      }
      if (message.type === 'error') {
        reject(new Error(`Benchmark fehlgeschlagen: ${message.message ?? 'unbekannt'}`))
        return
      }
      if (message.type === 'done' && message.result) {
        const r = message.result
        void (async () => {
          await sampleBefore
          const powerAfter = await samplePowerW()
          const watts = pickWatts(powerBefore, powerAfter)
          resolve({
            at: Date.now(),
            ms: r.ms || Date.now() - started,
            cores,
            floatFlops: r.floatFlops,
            intOps: r.intOps,
            hashPerSec: r.hashPerSec,
            memBytesPerSec: r.memBytesPerSec,
            parallelFlops: r.parallelFlops,
            memWriteBytesPerSec: r.memWriteBytesPerSec ?? null,
            memReadBytesPerSec: r.memReadBytesPerSec ?? null,
            memCopyBytesPerSec: r.memCopyBytesPerSec ?? r.memBytesPerSec,
            latency: r.latency ?? [],
            powerWatts: watts,
            powerSource: watts === null ? null : (powerBefore?.source ?? powerAfter.source),
            gflopsPerWatt: watts && watts > 0 ? r.floatFlops / 1e9 / watts : null,
            score: computeScore({
              floatFlops: r.floatFlops,
              intOps: r.intOps,
              hashPerSec: r.hashPerSec,
              memBytesPerSec: r.memBytesPerSec,
            }),
          })
        })()
      }
    })

    worker.on('error', (err) => reject(new Error(`Benchmark fehlgeschlagen: ${err.message}`)))
    worker.on('exit', (code) => {
      if (cancelled) {
        reject(new Error('Benchmark abgebrochen'))
        return
      }
      if (code !== 0) reject(new Error(`Benchmark-Worker beendet mit Code ${code}`))
    })
  })

  return {
    promise,
    cancel: () => {
      cancelled = true
      void worker?.terminate()
    },
  }
}

/** Beide Proben nutzen, wenn sie verwertbar sind, sonst die zweite allein. */
function pickWatts(before: PowerSample | null, after: PowerSample): number | null {
  const a = before?.watts ?? null
  const b = after.watts
  if (a !== null && b !== null) return (a + b) / 2
  return a ?? b
}
