import os from 'node:os'
import { Worker } from 'node:worker_threads'
import { computeScore, type BenchProgress, type BenchResult } from '../shared/bench.ts'

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
  { task: 'float', label: 'Gleitkomma (Float64)', ms: 800, base: 0, share: 25 },
  { task: 'int', label: 'Ganzzahl (int32)', ms: 700, base: 25, share: 20 },
  { task: 'hash', label: 'SHA-256', ms: 700, base: 45, share: 20 },
  { task: 'mem', label: 'Speicherbandbreite', ms: 700, base: 65, share: 20 },
  { task: 'parallel', label: 'Alle Kerne', ms: 700, base: 85, share: 15 }
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
  const size = 48 * 1024 * 1024
  const a = Buffer.allocUnsafe(size)
  const b = Buffer.allocUnsafe(size)
  b.fill(3)
  let moved = 0
  let guard = 0
  const t0 = now()
  let mark = t0
  for (;;) {
    b.copy(a)
    let s = 0
    for (let i = 0; i < size; i += 8192) s = (s + a[i]) | 0
    guard = (guard + s) | 0
    moved += size
    const t = now()
    if (t - t0 >= durationMs) return { value: moved / ((t - t0) / 1000), guard: guard }
    if (t - mark >= 80) { tick((t - t0) / durationMs); mark = t }
  }
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
    const parOut = await runParallel(PLAN[4].ms, (w) => report(4, w))
    parentPort.postMessage({
      type: 'done',
      result: {
        ms: Date.now() - started,
        floatFlops: floatOut.value,
        intOps: intOut.value,
        hashPerSec: hashOut.value,
        hashBytesPerSec: hashOut.bytes,
        memBytesPerSec: memOut.value,
        parallelFlops: parOut.value
      }
    })
  } catch (err) {
    parentPort.postMessage({ type: 'error', message: String((err && err.stack) || err) })
  }
})()
`

// ---------------------------------------------------------------------------
// Start / Abbruch
// ---------------------------------------------------------------------------

const ORDER: BenchProgress['task'][] = ['float', 'int', 'hash', 'mem', 'parallel']

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
    parallelFlops: number
  }
  message?: string
}

/** Startet die Suite. Rückgabe enthält ein Promise und eine Abbruchfunktion. */
export function startBench(onProgress?: (progress: BenchProgress) => void): BenchHandle {
  const started = Date.now()
  let worker: Worker | null = null
  let cancelled = false

  const promise = new Promise<BenchResult>((resolve, reject) => {
    try {
      worker = new Worker(SUITE_SOURCE, {
        eval: true,
        workerData: { floatSource: FLOAT_SOURCE, cores: os.availableParallelism() },
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
        resolve({
          at: Date.now(),
          ms: r.ms || Date.now() - started,
          cores: os.availableParallelism(),
          floatFlops: r.floatFlops,
          intOps: r.intOps,
          hashPerSec: r.hashPerSec,
          memBytesPerSec: r.memBytesPerSec,
          parallelFlops: r.parallelFlops,
          score: computeScore({
            floatFlops: r.floatFlops,
            intOps: r.intOps,
            hashPerSec: r.hashPerSec,
            memBytesPerSec: r.memBytesPerSec,
          }),
        })
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
