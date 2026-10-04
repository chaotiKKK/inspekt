import { spawn, execFile, type ChildProcessByStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import path from 'node:path'
import { SnapshotSchema, TelemetrySchema, type Snapshot, type Telemetry, type NvidiaGpu } from '../shared/schema.ts'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const PS_EXE = (() => {
  const root = process.env.SystemRoot ?? 'C:\\Windows'
  return path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
})()

interface RunResult {
  stdout: string
  stderr: string
  code: number | null
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new Error(`"${cmd}" timed out after ${timeoutMs} ms`))
    }, timeoutMs)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, code })
    })
  })
}

export function powershellExe(): string {
  return PS_EXE
}

const ELEVATED_COMMAND =
  "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"

let elevatedCache: boolean | null = null

/**
 * Windows has no Node API for this, so we ask PowerShell once and cache the
 * answer (a fresh `powershell.exe` costs ~700 ms).
 */
export async function isElevated(timeoutMs = 8000): Promise<boolean> {
  if (elevatedCache !== null) return elevatedCache
  try {
    const { stdout, code } = await run(PS_EXE, ['-NoProfile', '-NonInteractive', '-Command', ELEVATED_COMMAND], timeoutMs)
    elevatedCache = code === 0 && /^True/i.test(stdout.trim())
  } catch {
    elevatedCache = false
  }
  return elevatedCache
}

export function resetElevationCache(): void {
  elevatedCache = null
}

/**
 * Sections are grouped so that several PowerShell processes can collect them
 * in parallel. Groups are balanced by measured runtime on a real machine
 * (system and devices/sensors are the slow ones).
 */
export const SECTION_GROUPS: string[][] = [
  ['system'],
  ['cpu', 'memory', 'battery', 'security'],
  ['storage'],
  ['gpu', 'monitors', 'network'],
  ['devices', 'sensors'],
]

export function splitGroups(sections: string[]): string[][] {
  return SECTION_GROUPS.map((group) => group.filter((s) => sections.includes(s))).filter((g) => g.length > 0)
}

// ---------------------------------------------------------------------------
// snapshot collection
// ---------------------------------------------------------------------------

export interface CollectOptions {
  scriptPath: string
  sections?: string[]
  timeoutMs?: number
  useNvidia?: boolean
  onSection?: (name: string) => void
}

interface RawGroupResult {
  schema?: string
  collectedAt?: string
  elevated?: boolean
  psVersion?: string
  totalMs?: number
  sections?: Record<string, unknown>
}

function assertSnapshot(snapshot: unknown): Snapshot {
  const parsed = SnapshotSchema.safeParse(snapshot)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ')
    throw new Error(`Snapshot schema mismatch: ${issues}`)
  }
  return parsed.data
}

async function mergeNvidia(snapshot: Snapshot): Promise<void> {
  const nv = await nvidiaSnapshot()
  const gpu = snapshot.sections.gpu
  if (gpu.ok && gpu.data) {
    gpu.data.nvidia = nv.data
    gpu.data.nvidiaError = nv.error
  }
}

/**
 * Runs the PowerShell collector in parallel groups, reports progress per
 * section and returns a schema-validated snapshot.
 */
export async function collectRaw(options: CollectOptions): Promise<{ snapshot: Snapshot; meta: Record<string, unknown> }> {
  const all = options.sections?.length
    ? options.sections
    : ['system', 'cpu', 'memory', 'storage', 'gpu', 'monitors', 'network', 'devices', 'battery', 'security', 'sensors']
  const groups = splitGroups(all)
  const timeoutMs = options.timeoutMs ?? 120_000

  const raws = await Promise.all(
    groups.map(async (group) => {
      const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', options.scriptPath, '-Section', group.join(',')]
      const { stdout, stderr, code } = await run(PS_EXE, args, timeoutMs)
      if (code !== 0) {
        throw new Error(`Collector group [${group.join(',')}] exited with ${code}: ${stderr.trim().slice(0, 400)}`)
      }
      let parsed: RawGroupResult
      try {
        parsed = JSON.parse(stdout) as RawGroupResult
      } catch (err) {
        throw new Error(`Collector group [${group.join(',')}] returned invalid JSON (${(err as Error).message}): ${stdout.slice(0, 300)}`)
      }
      if (!parsed || typeof parsed !== 'object' || !parsed.sections) {
        throw new Error(`Collector group [${group.join(',')}] produced no "sections" object`)
      }
      for (const name of group) {
        if (parsed.sections[name] !== undefined) options.onSection?.(name)
      }
      return parsed
    }),
  )

  const sections: Record<string, unknown> = {}
  let maxMs = 0
  let elevated = false
  let psVersion: string | null = null
  let collectedAt: string | null = null
  for (const raw of raws) {
    Object.assign(sections, raw.sections ?? {})
    maxMs = Math.max(maxMs, typeof raw.totalMs === 'number' ? raw.totalMs : 0)
    elevated = elevated || raw.elevated === true
    if (raw.psVersion) psVersion = raw.psVersion
    if (raw.collectedAt) collectedAt = raw.collectedAt
  }

  const snapshot = assertSnapshot({
    schema: 'inspekt/snapshot',
    collectedAt: collectedAt ?? new Date().toISOString(),
    elevated,
    psVersion,
    totalMs: maxMs,
    sections,
  })

  if (options.useNvidia !== false) await mergeNvidia(snapshot)

  return {
    snapshot,
    meta: {
      collectedAt: snapshot.collectedAt,
      elevated: snapshot.elevated,
      totalMs: snapshot.totalMs,
      psVersion: snapshot.psVersion,
    },
  }
}

export async function collect(options: CollectOptions): Promise<Snapshot> {
  const { snapshot } = await collectRaw(options)
  return snapshot
}

export async function collectSectionSnapshot(
  scriptPath: string,
  sections: string[],
  timeoutMs = 60_000,
): Promise<Record<string, unknown>> {
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Section', sections.join(',')]
  const { stdout, stderr, code } = await run(PS_EXE, args, timeoutMs)
  if (code !== 0) throw new Error(`Collector exited with ${code}: ${stderr.trim().slice(0, 400)}`)
  const parsed = JSON.parse(stdout) as RawGroupResult
  return parsed.sections ?? {}
}

// ---------------------------------------------------------------------------
// nvidia-smi
// ---------------------------------------------------------------------------

function num(value: string | undefined): number | null {
  if (value === undefined) return null
  const t = value.trim()
  if (!t || /^\[?N\/A\]?$/i.test(t) || t === 'None') return null
  const v = Number.parseFloat(t)
  return Number.isFinite(v) ? v : null
}

const NV_QUERY = [
  'index',
  'name',
  'uuid',
  'temperature.gpu',
  'utilization.gpu',
  'utilization.memory',
  'memory.used',
  'memory.total',
  'clocks.current.sm',
  'clocks.max.sm',
  'clocks.current.memory',
  'fan.speed',
  'power.draw',
  'power.limit',
  'driver_version',
].join(',')

function parseNvidiaCsv(stdout: string, fields: string[]): NvidiaGpu[] {
  const out: NvidiaGpu[] = []
  const get = (parts: string[], name: string): string => {
    const i = fields.indexOf(name)
    return i >= 0 && i < parts.length ? parts[i] : ''
  }
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(',').map((p) => p.trim())
    if (parts.length < fields.length) continue
    out.push({
      index: Number.parseInt(get(parts, 'index'), 10) || 0,
      name: get(parts, 'name'),
      uuid: get(parts, 'uuid') || null,
      tempC: num(get(parts, 'temperature.gpu')),
      utilPct: num(get(parts, 'utilization.gpu')),
      memUtilPct: num(get(parts, 'utilization.memory')),
      memUsedMb: num(get(parts, 'memory.used')),
      memTotalMb: num(get(parts, 'memory.total')),
      clockSmMhz: num(get(parts, 'clocks.current.sm')),
      clockMaxSmMhz: num(get(parts, 'clocks.max.sm')),
      clockMemMhz: num(get(parts, 'clocks.current.memory')),
      fanPct: num(get(parts, 'fan.speed')),
      powerW: num(get(parts, 'power.draw')),
      powerLimitW: num(get(parts, 'power.limit')),
      driverVersion: get(parts, 'driver_version') || null,
    })
  }
  return out
}

function nvidia(query: string, timeoutMs = 6000): Promise<{ gpus: NvidiaGpu[]; error?: string }> {
  return new Promise((resolve) => {
    execFile(
      'nvidia-smi',
      [`--query-gpu=${query}`, '--format=csv,noheader,nounits'],
      { timeout: timeoutMs, windowsHide: true, encoding: 'utf8', maxBuffer: 1 << 20 },
      (error, stdout) => {
        if (error) {
          const code = (error as NodeJS.ErrnoException).code
          const msg = code === 'ENOENT' ? 'nvidia-smi nicht installiert' : error.message
          resolve({ gpus: [], error: msg.split('\n')[0] })
          return
        }
        try {
          resolve({ gpus: parseNvidiaCsv(String(stdout), query.split(',').map((f) => f.trim())) })
        } catch (err) {
          resolve({ gpus: [], error: (err as Error).message })
        }
      },
    )
  })
}

export async function nvidiaSnapshot(): Promise<{ data: NvidiaGpu | null; error?: string }> {
  const { gpus, error } = await nvidia(NV_QUERY)
  if (gpus.length === 0) return { data: null, error: error ?? 'keine NVIDIA-GPU gefunden' }
  return { data: gpus[0] }
}

export async function nvidiaGpus(): Promise<{ gpus: NvidiaGpu[]; error?: string }> {
  return nvidia(NV_QUERY)
}

// ---------------------------------------------------------------------------
// live telemetry
// ---------------------------------------------------------------------------

const TELEMETRY_QUERY = ['temperature.gpu', 'utilization.gpu', 'memory.used', 'memory.total', 'power.draw', 'fan.speed'].join(',')

export async function nvidiaTelemetry(): Promise<Partial<NvidiaGpu>> {
  const { gpus, error } = await nvidia(TELEMETRY_QUERY, 4000)
  if (error || gpus.length === 0) return {}
  const g = gpus[0]
  return { tempC: g.tempC, utilPct: g.utilPct, memUsedMb: g.memUsedMb, memTotalMb: g.memTotalMb, powerW: g.powerW, fanPct: g.fanPct }
}

export interface TelemetryStream {
  stop: () => void
}

interface TickPayload {
  type?: string
  at?: number
  cpuLoadPercent?: number | null
  memoryFreeMB?: number | null
  memoryTotalMB?: number | null
  disk?: { percent?: number | null; queue?: number | null } | null
  network?: { rxBps?: number | null; txBps?: number | null } | null
  error?: string | null
}

/**
 * Keeps one PowerShell process alive (the WMI repository stays warm) and
 * pushes a validated telemetry object for every line the script writes.
 */
export function startTelemetry(
  scriptPath: string,
  onTick: (t: Telemetry) => void,
  onError?: (message: string) => void,
): TelemetryStream {
  let child: ChildProcessByStdio<null, Readable, Readable>
  try {
    child = spawn(PS_EXE, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    onError?.((err as Error).message)
    return { stop: () => {} }
  }

  let buffer = ''
  let stopped = false
  let gpu: Partial<NvidiaGpu> = {}
  let emitting = false
  let pending: TickPayload | null = null

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk
    let idx = buffer.indexOf('\n')
    while (idx >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      idx = buffer.indexOf('\n')
      if (!line.startsWith('{')) continue
      let payload: TickPayload
      try {
        payload = JSON.parse(line) as TickPayload
      } catch {
        continue
      }
      if (payload.type !== 'tick') continue
      pending = payload
      void drain()
    }
  })

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    const text = chunk.trim()
    if (text) onError?.(text.slice(0, 300))
  })

  child.on('error', (err) => {
    if (!stopped) onError?.(err.message)
  })
  child.on('close', () => {
    if (!stopped) onError?.('Telemetrie-Prozess beendet')
  })

  async function drain() {
    if (emitting) return
    emitting = true
    try {
      while (pending && !stopped) {
        const payload = pending
        pending = null
        gpu = { ...gpu, ...(await nvidiaTelemetry()) }
        const candidate = {
          at: payload.at ?? Date.now(),
          cpuLoadPercent: payload.cpuLoadPercent ?? null,
          memoryFreeMB: payload.memoryFreeMB ?? null,
          memoryTotalMB: payload.memoryTotalMB ?? null,
          diskPercent: payload.disk?.percent ?? null,
          diskQueue: payload.disk?.queue ?? null,
          rxBps: payload.network?.rxBps ?? null,
          txBps: payload.network?.txBps ?? null,
          gpuTempC: gpu.tempC ?? null,
          gpuUtilPct: gpu.utilPct ?? null,
          gpuMemUsedMb: gpu.memUsedMb ?? null,
          gpuMemTotalMb: gpu.memTotalMb ?? null,
          gpuPowerW: gpu.powerW ?? null,
          gpuFanPct: gpu.fanPct ?? null,
        }
        const parsed = TelemetrySchema.safeParse(candidate)
        if (parsed.success && !stopped) onTick(parsed.data)
      }
    } finally {
      emitting = false
    }
  }

  return {
    stop() {
      if (stopped) return
      stopped = true
      try {
        child.kill()
      } catch {
        /* already gone */
      }
    },
  }
}
