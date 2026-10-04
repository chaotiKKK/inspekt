import path from 'node:path'
import { collectRaw, SECTION_GROUPS } from '../node/collect.ts'

const root = path.resolve(import.meta.dirname, '..')
const scriptPath = path.join(root, 'electron', 'collector', 'collect.ps1')

let failures = 0
let warnings = 0

function ok(label: string, condition: boolean, detail: string | null = ''): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    failures++
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

function warn(label: string, condition: boolean, detail: string | null = ''): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    warnings++
    console.log(`  WARN  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

const allSections = ['system', 'cpu', 'memory', 'storage', 'gpu', 'monitors', 'network', 'devices', 'battery', 'security', 'sensors']

console.log('collect-smoke: reading this machine via PowerShell\n')
const started = Date.now()
const { snapshot, meta } = await collectRaw({ scriptPath })
const wall = Date.now() - started

console.log(`  wall time ${wall} ms, ps ${meta.totalMs} ms, elevated=${meta.elevated}, ps=${meta.psVersion}\n`)

console.log('structure')
ok('every section is present', allSections.every((s) => s in snapshot.sections), Object.keys(snapshot.sections).join(','))
ok('section groups cover every section once', SECTION_GROUPS.flat().sort().join() === [...allSections].sort().join())
const roundTrip = JSON.parse(JSON.stringify(snapshot))
ok('JSON round trip is lossless', JSON.stringify(roundTrip) === JSON.stringify(snapshot))

const serialized = JSON.stringify(snapshot)
ok('no replacement characters (UTF-8 intact)', !serialized.includes('\uFFFD'))

console.log('\nsections')
for (const [name, section] of Object.entries(snapshot.sections)) {
  const detail = section.ok ? `${section.ms ?? '?'} ms` : (section.error ?? 'unknown error')
  if (section.ok) ok(`${name} collected`, true, detail)
  else warn(`${name} collected`, false, detail)
}

const sys = snapshot.sections.system.data
console.log('\nsystem')
ok('manufacturer + model', Boolean(sys?.manufacturer && sys?.model), `${sys?.manufacturer} ${sys?.model}`)
ok('operating system caption', Boolean(sys?.osCaption), sys?.osCaption)
ok('memory reported in bytes', (sys?.totalMemory ?? 0) > 1024 * 1024, `${sys?.totalMemory} bytes`)
ok('firmware type known', Boolean(sys?.firmwareType), sys?.firmwareType)

const cpu = snapshot.sections.cpu.data
console.log('\ncpu')
ok('at least one processor', (cpu?.count ?? 0) >= 1, `${cpu?.count}x ${cpu?.name}`)
ok('cores and threads reported', (cpu?.cores ?? 0) >= 1 && (cpu?.threads ?? 0) >= 1, `${cpu?.cores}C/${cpu?.threads}T`)

const mem = snapshot.sections.memory.data
console.log('\nmemory (slot detection)')
ok('slot count readable', (mem?.slotsTotal ?? 0) >= 1, `${mem?.slotsTotal} slots`)
ok('slot count >= populated modules', (mem?.slotsTotal ?? 0) >= (mem?.slotsUsed ?? 0), `${mem?.slotsUsed}/${mem?.slotsTotal} belegt`)
ok('every module has a capacity', (mem?.modules ?? []).every((m) => (m.capacity ?? 0) > 0), `${(mem?.modules ?? []).length} module`)
ok('every module has a speed', (mem?.modules ?? []).every((m) => (m.speed ?? 0) > 0))
ok('every module has a SMBIOS type code', (mem?.modules ?? []).every((m) => (m.smbiosType ?? -1) >= 0))

const sto = snapshot.sections.storage.data
console.log('\nstorage')
ok('at least one physical disk', (sto?.disks ?? []).length >= 1, `${(sto?.disks ?? []).length} disk(s)`)
ok('every disk has a size', (sto?.disks ?? []).every((d) => (d.size ?? 0) > 0))
ok('every disk has partitions listed', (sto?.disks ?? []).every((d) => Array.isArray(d.partitions)))
const busTypes = [...new Set((sto?.disks ?? []).map((d) => d.busType).filter(Boolean))]
ok('bus type resolved for every disk', (sto?.disks ?? []).every((d) => Boolean(d.busType)), busTypes.join('/') || 'keine')

const gpu = snapshot.sections.gpu.data
console.log('\ngpu')
ok('at least one adapter', (gpu?.adapters ?? []).length >= 1, `${(gpu?.adapters ?? []).length} adapter`)
warn('nvidia-smi present (optional)', !gpu?.nvidiaError, gpu?.nvidiaError ?? `GPU ${gpu?.nvidia?.name} ${gpu?.nvidia?.tempC} C`)
if (gpu?.nvidia) {
  ok('nvidia telemetry values sane', (gpu.nvidia.tempC ?? -1) > 0 && (gpu.nvidia.memTotalMb ?? 0) > 0, `${gpu.nvidia.tempC} C, ${gpu.nvidia.memUsedMb}/${gpu.nvidia.memTotalMb} MiB`)
}

const dev = snapshot.sections.devices.data
console.log('\ndevices')
ok('pnp device list is populated', (dev?.count ?? 0) > 0, `${dev?.count} devices`)
ok('class histogram matches item count', Object.values(dev?.byClass ?? {}).reduce((a, b) => a + b, 0) === (dev?.count ?? -1))

const net = snapshot.sections.network.data
console.log('\nnetwork')
ok('at least one adapter', (net?.adapters ?? []).length >= 1, `${(net?.adapters ?? []).length} adapters`)
warn('at least one adapter is up', (net?.adapters ?? []).some((a) => a.status === 'Up'), (net?.adapters ?? []).filter((a) => a.status === 'Up').map((a) => a.name).join(', ') || 'keine')

const mon = snapshot.sections.monitors.data
console.log('\nmonitors')
warn('edid readable for at least one display', (mon?.monitors ?? []).length >= 1, `${(mon?.monitors ?? []).length} Monitore`)

const sec = snapshot.sections.security.data
console.log('\nsecurity')
warn('secure boot state readable', sec?.secureBoot !== undefined && sec?.secureBoot !== null, `secureBoot=${sec?.secureBoot} bootMode=${sec?.bootMode}`)

console.log(`\n${failures === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failures} failure(s))`}${warnings ? `, ${warnings} warning(s)` : ''}`)
process.exit(failures === 0 ? 0 : 1)
