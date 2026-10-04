import { startBench } from '../node/bench.ts'
import { BENCH_TOTAL, computeScore, type BenchProgress } from '../shared/bench.ts'
import { REFERENCE_MACHINES, secondsForReference, siValue, speedFactor } from '../shared/compare.ts'

let failures = 0

function ok(label: string, condition: boolean, detail: string | null = ''): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    failures++
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

console.log('bench-smoke: Messsuite im Worker-Thread\n')

const seen: BenchProgress[] = []
const handle = startBench((p) => {
  if (seen[seen.length - 1]?.task !== p.task) seen.push(p)
})

let cancelled = false
const watchdog = setTimeout(() => {
  cancelled = true
  handle.cancel()
}, 30000)

const result = await handle.promise.catch((err: Error) => {
  clearTimeout(watchdog)
  console.error(err.message)
  return null
})
clearTimeout(watchdog)

console.log('\nergebnis')
if (!result) {
  console.log('  FAIL  Benchmark lieferte kein Ergebnis' + (cancelled ? ' (Timeout)' : ''))
  process.exit(1)
}

ok('läuft innerhalb der Zeitgrenze', result.ms > 500 && result.ms < 25000, `${result.ms} ms`)
ok('Kernanzahl bekannt', result.cores >= 1, `${result.cores} Kerne`)
ok('Gleitkomma messbar', result.floatFlops > 1e6, `${result.floatFlops.toExponential(2)} FLOP/s`)
ok('Ganzzahl messbar', result.intOps > 1e6, `${result.intOps.toExponential(2)} OPS/s`)
ok('SHA-256 messbar', result.hashPerSec > 1, `${result.hashPerSec.toFixed(1)} /s`)
ok('Bandbreite messbar', result.memBytesPerSec > 100 * 1024 ** 2, `${(result.memBytesPerSec / 1024 ** 3).toFixed(1)} GB/s`)
ok('Multi-Core höher als ein Kern', result.parallelFlops > result.floatFlops * 1.1, `${(result.parallelFlops / result.floatFlops).toFixed(2)}×`)
ok('Score positiv', result.score > 0, `${result.score} Punkte`)
ok('Fortschritt meldet alle', seen.length >= BENCH_TOTAL, seen.map((s) => s.task).join(', '))
ok('Fortschritt wächst', seen.every((s, i) => i === 0 || s.pct > 0), `${seen.map((s) => Math.round(s.pct)).join('→')} %`)
ok('Score-Formel reproduzierbar', computeScore(result) === result.score, `${result.score}`)

console.log('\nreferenzdaten')
ok('~30 Maschinen hinterlegt', REFERENCE_MACHINES.length >= 28, `${REFERENCE_MACHINES.length} Einträge`)
ok('Jahreszahlen plausibel', REFERENCE_MACHINES.every((m) => m.year >= 1900 && m.year <= 2030), null)
ok('GFLOPS-Werte positiv', REFERENCE_MACHINES.every((m) => m.gflops > 0), null)
ok('Schätzungen gekennzeichnet', REFERENCE_MACHINES.filter((m) => m.basis === 'schätzung').length > 0, `${REFERENCE_MACHINES.filter((m) => m.basis === 'schätzung').length} Schätzungen`)
ok('IDs eindeutig', new Set(REFERENCE_MACHINES.map((m) => m.id)).size === REFERENCE_MACHINES.length, null)

const agc = REFERENCE_MACHINES.find((m) => m.id === 'agc')!
const seconds = secondsForReference(result.floatFlops, agc.gflops)
ok('Zeitvergleich gegen Apollo-AGC', seconds !== null && seconds > 60, seconds ? `${(seconds / 86400).toFixed(1)} Tage` : 'null')
ok('Faktor gegen C64', (speedFactor(result.floatFlops, REFERENCE_MACHINES.find((m) => m.id === 'c64')!.gflops) ?? 0) > 1000, null)
ok('SI-Formatierung deutsch', siValue(1.25e9, 'FLOPS') === '1,25 GFLOPS', siValue(1.25e9, 'FLOPS'))
ok('SI-Formatierung klein', siValue(4.3e-5, 'FLOPS').includes('FLOPS'), siValue(4.3e-5, 'FLOPS'))

console.log(`\n${failures} failure(s)`)
process.exit(failures > 0 ? 1 : 0)
