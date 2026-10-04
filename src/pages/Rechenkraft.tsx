import { useEffect, useState } from 'react'
import { Gauge, PlayCircle, XCircle } from 'lucide-react'
import { BarLog, type BarRow } from '../components/charts/BarLog.tsx'
import { ChartFrame } from '../components/charts/ChartFrame.tsx'
import { LiveChart, SERIES_COLORS } from '../components/charts/LiveChart.tsx'
import { MiniBars } from '../components/charts/Mini.tsx'
import { ScatterLog, type ScatterPoint } from '../components/charts/ScatterLog.tsx'
import { TimeBars, type TimeBarItem } from '../components/charts/TimeBars.tsx'
import { Badge, DataTable, EmptyState, Notice, Panel, StatTile } from '../components/ui.tsx'
import { BENCH_TOTAL, latencyTier, SCORE_BASELINE, type BenchProgress } from '../../shared/bench.ts'
import { REFERENCE_MACHINES, TIMEBAR_IDS, referenceById, secondsForReference, siValue, speedFactor } from '../../shared/compare.ts'
import { cancelBench, clearBenchHistory, initBenchHistory, runBench, useBench } from '../lib/bench.ts'
import { bytes, int, num, watt } from '../lib/format.ts'
import type { PageProps } from './PageProps.ts'

interface TaskInfo {
  key: BenchProgress['task']
  label: string
  detail: string
}

const TASKS: TaskInfo[] = [
  { key: 'float', label: 'Gleitkomma', detail: 'Float64-Arithmetik auf einem Kern – der klassische FLOPS-Test' },
  { key: 'int', label: 'Ganzzahl', detail: '64-Bit-Multiplikation und Verkettung, misst die Ganzzahl-Pipeline' },
  { key: 'hash', label: 'SHA-256', detail: '1 MiB Datensatz je Durchlauf – reine Rechenlast ohne Speicherflaschenhals' },
  { key: 'mem', label: 'Bandbreite', detail: 'Lesen, Schreiben und Kopieren von 48 MiB – getrennt gemessen' },
  { key: 'latency', label: 'Latenz', detail: 'Zufallssprung über 4 KiB bis 64 MiB, zeigt L1, L2, L3 und RAM' },
  { key: 'parallel', label: 'Parallel', detail: 'Gleitkomma-Arbeit gleichzeitig auf allen Kernen' },
]

const barTasks = TASKS.map((t) => t.key)

export function RechenkraftPage({ snapshot }: PageProps): React.ReactNode {
  const { running, progress, result, error, history } = useBench()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => initBenchHistory(), [])

  const cpuName = snapshot?.sections.cpu.data?.name ?? 'Dieser Rechner'
  const cores = result?.cores ?? snapshot?.sections.cpu.data?.cores ?? null

  const barRows: BarRow[] = REFERENCE_MACHINES.map((m) => ({
    id: m.id,
    label: m.name,
    value: m.gflops,
    estimated: m.basis === 'schätzung',
    hint: `${m.year} · ${m.kind}${m.note ? ` · ${m.note}` : ''}`,
  }))
  if (result) {
    barRows.push({ id: 'own', label: 'Dieser Rechner', value: result.floatFlops, highlight: true, hint: cpuName })
  }

  const rangeValues = barRows.map((r) => r.value)
  const decades = Math.max(1, Math.round(Math.log10(Math.max(...rangeValues)) - Math.log10(Math.min(...rangeValues))))

  const scatterPoints: ScatterPoint[] = REFERENCE_MACHINES.map((m) => ({
    id: m.id,
    name: m.name,
    year: m.year,
    gflops: m.gflops,
    estimated: m.basis === 'schätzung',
    note: m.note ?? null,
    source: m.source?.label ?? null,
  }))
  if (result) {
    scatterPoints.push({ id: 'own', name: cpuName, year: new Date().getFullYear(), gflops: result.floatFlops, highlight: true })
  }

  const timeItems: TimeBarItem[] = []
  if (result) {
    for (const id of TIMEBAR_IDS) {
      const machine = referenceById(id)
      if (!machine) continue
      const seconds = secondsForReference(result.floatFlops, machine.gflops)
      if (seconds === null) continue
      const factor = speedFactor(result.floatFlops, machine.gflops)
      timeItems.push({
        id,
        label: machine.name,
        seconds,
        hint: factor === null ? machine.name : `${num(factor)}× schneller als ${machine.name}`,
      })
    }
  }

  const currentIndex = progress ? barTasks.indexOf(progress.task) : -1

  return (
    <div className="space-y-5" data-bench="page">
      <section className="panel relative overflow-hidden px-6 py-6" data-bench="hero">
        <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden="true" />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="eyebrow">Messsuite · {TASKS.length} Aufgaben · {cores ?? '—'} Kerne</div>
            <h2 className="mt-2 font-mono text-[26px] leading-tight font-semibold tracking-tight text-fg">Rechenkraft</h2>
            <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-muted">
              Ein kurzer, ehrlicher Leistungstest direkt in der App: Gleitkomma, Ganzzahl, SHA-256, Speicherbandbreite,
              Latenz und Multi-Core – danach steht der Wert neben {REFERENCE_MACHINES.length} historischen Rechnern, von der Zuse Z1 bis
              zum RTX 4090.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">Node/V8 auf diesem Rechner</span>
              <span className="chip">≈ 5 s Laufzeit</span>
              <span className="chip">läuft im Worker-Thread, UI bleibt frei</span>
              {history.length > 0 && <span className="chip">{history.length} Läufe gespeichert</span>}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {!running ? (
              <button type="button" className="btn flex items-center gap-2" data-bench="run" onClick={() => void runBench()}>
                <PlayCircle size={16} aria-hidden="true" />
                Benchmark starten
              </button>
            ) : (
              <button type="button" className="btn flex items-center gap-2" onClick={() => void cancelBench()}>
                <XCircle size={16} aria-hidden="true" />
                Abbrechen
              </button>
            )}
            {result && !running && (
              <div className="text-right font-mono text-[11px] text-faint">
                zuletzt {new Date(result.at).toLocaleString('de-DE')}
                <br />
                Dauer {num(result.ms)} ms
              </div>
            )}
          </div>
        </div>

        {running && (
          <div className="mt-5" data-bench="progress">
            <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-muted">
              <span>{progress?.label ?? 'wird gestartet …'}</span>
              <span className="text-accent">{Math.round(progress?.pct ?? 0)} %</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-panel2 ring-1 ring-line ring-inset">
              <div
                className="h-full bg-accent transition-[width] duration-300 ease-linear"
                style={{ width: `${progress?.pct ?? 0}%` }}
              />
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {TASKS.map((task, i) => {
                const done = i < currentIndex
                const active = i === currentIndex
                return (
                  <div
                    key={task.key}
                    className={`flex items-center gap-2 rounded border px-2.5 py-1.5 font-mono text-[11.5px] ${
                      active ? 'border-accent/50 bg-accent/10 text-accent' : done ? 'border-line bg-panel2 text-fg' : 'border-line text-faint'
                    }`}
                  >
                    <span aria-hidden="true">{done ? '✓' : active ? '▸' : '·'}</span>
                    <span>{task.label}</span>
                    <span className="ml-auto text-faint">{done ? 'fertig' : active ? 'läuft' : 'wartet'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {error && !dismissed && (
        <Notice tone={error === 'Benchmark abgebrochen.' ? 'warn' : 'bad'} title="Messung nicht beendet" action={
          <button type="button" className="btn" onClick={() => setDismissed(true)}>
            Ausblenden
          </button>
        }>
          {error}
        </Notice>
      )}

      {result ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-bench="result">
            <StatTile label="Inspekt-Score" value={num(result.score)} unit="Punkte" hint="geometrisches Mittel, ×100" />
            <StatTile label="Gleitkomma" value={siValue(result.floatFlops, 'FLOPS')} hint="1 Kern · Float64" />
            <StatTile label="Ganzzahl" value={siValue(result.intOps, 'OPS')} hint="1 Kern · 64 Bit" />
            <StatTile label="SHA-256" value={int(result.hashPerSec)} unit="/s" hint="je 1 MiB Datensatz" />
            <StatTile label="Bandbreite" value={bytes(result.memCopyBytesPerSec ?? result.memBytesPerSec)} unit="/s" hint="Kopieren im Arbeitsspeicher" />
            <StatTile
              label="Multi-Core-Faktor"
              value={`${(result.parallelFlops / Math.max(1, result.floatFlops)).toFixed(2)}×`}
              hint={`${cores} Kerne gleichzeitig`}
            />
            <StatTile
              label="Leistungsaufnahme"
              value={result.powerWatts !== null && result.powerWatts !== undefined ? watt(result.powerWatts) : '—'}
              tone={result.powerWatts ? 'default' : 'warn'}
              hint={
                result.powerWatts
                  ? `gemessen aus dem Akku (${result.powerSource === 'ladung' ? 'Ladung' : 'Entladung'})`
                  : 'dieses Gerät meldet keine Leistungswerte'
              }
            />
            <StatTile
              label="Gleitleistung pro Watt"
              value={result.gflopsPerWatt ? `${result.gflopsPerWatt.toFixed(2)} GFLOPS/W` : '—'}
              hint={result.gflopsPerWatt ? 'Gleitkomma-Leistung je Watt' : 'nur mit Akkuleistung messbar'}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel code="RAM" title="Speicher im Detail">
              <MiniBars
                unitSuffix="/s"
                items={[
                  { id: 'write', label: 'Schreiben', value: result.memWriteBytesPerSec ?? 0, display: bytes(result.memWriteBytesPerSec ?? 0), hint: '48 MiB Puffer füllen' },
                  { id: 'read', label: 'Lesen', value: result.memReadBytesPerSec ?? 0, display: bytes(result.memReadBytesPerSec ?? 0), hint: '48 MiB durchlaufen' },
                  { id: 'copy', label: 'Kopieren', value: result.memCopyBytesPerSec ?? result.memBytesPerSec, display: bytes(result.memCopyBytesPerSec ?? result.memBytesPerSec), hint: 'Basis für den Score' },
                ]}
              />
              <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
                Ein Kern erreicht niemals die volle Bandbreite des Speichercontrollers. Der Wert zeigt, was ein einzelner
                Kern tatsächlich an Daten bekommt – Multi-Core steht weiter unten.
              </p>
            </Panel>

            <Panel code="LAT" title="Latenz – Cache-Hierarchie">
              <MiniBars
                items={(result.latency ?? []).map((l) => ({
                  id: `lat-${l.bytes}`,
                  label: latencyTier(l.bytes),
                  value: l.ns,
                  display: `${l.ns.toFixed(1)} ns`,
                  hint: 'Zufallssprung, mindestens 30 ms gemessen',
                  color: l.ns < 10 ? '#10b981' : l.ns < 80 ? '#f59e0b' : '#f43f5e',
                }))}
                empty="Keine Latenzwerte."
              />
              <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
                Ein Sprung durch die Speicherzellen mit zufälliger Reihenfolge: der nächste Zugriff kann erst starten, wenn
                der aktuelle beantwortet ist. 2–5 ns bedeuten L1/L2, 100 ns und mehr echten Arbeitsspeicher.
              </p>
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Panel code="FLO" title="Messwerte im Detail">
              <DataTable
                headers={['Aufgabe', 'Ergebnis', 'Baseline', 'Faktor']}
                rows={[
                  ['Gleitkomma (1 Kern)', siValue(result.floatFlops, 'FLOPS'), '1 GFLOPS', `${(result.floatFlops / SCORE_BASELINE.float).toFixed(2)}×`],
                  ['Ganzzahl (1 Kern)', siValue(result.intOps, 'OPS'), '1 GOPS', `${(result.intOps / SCORE_BASELINE.int).toFixed(2)}×`],
                  ['SHA-256', `${int(result.hashPerSec)} /s`, '1.000 /s', `${(result.hashPerSec / SCORE_BASELINE.hash).toFixed(2)}×`],
                  ['Bandbreite (Kopieren)', `${bytes(result.memCopyBytesPerSec ?? result.memBytesPerSec)}/s`, '10 GB/s', `${((result.memCopyBytesPerSec ?? result.memBytesPerSec) / SCORE_BASELINE.mem).toFixed(2)}×`],
                  ['Bandbreite (Lesen)', `${bytes(result.memReadBytesPerSec ?? 0)}/s`, '—', 'nicht im Score'],
                  ['Bandbreite (Schreiben)', `${bytes(result.memWriteBytesPerSec ?? 0)}/s`, '—', 'nicht im Score'],
                  ['RAM-Latenz', (result.latency ?? []).length ? `${num((result.latency ?? [])[(result.latency ?? []).length - 1]?.ns ?? 0, 1)} ns` : '—', '—', '64 MiB Arbeitsset'],
                  ['Parallel (alle Kerne)', siValue(result.parallelFlops, 'FLOPS'), `1 Kern: ${siValue(result.floatFlops, 'FLOPS')}`, `${(result.parallelFlops / Math.max(1, result.floatFlops)).toFixed(2)}×`],
                ]}
              />
            </Panel>

            <Panel code="SPEC" title="Was gemessen wird">
              <ul className="space-y-3">
                {TASKS.map((task) => (
                  <li key={task.key}>
                    <div className="font-mono text-[12px] font-semibold text-fg">{task.label}</div>
                    <div className="text-[12px] leading-relaxed text-muted">{task.detail}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-line pt-3 font-mono text-[10.5px] leading-relaxed text-faint">
                Die Suite läuft als JavaScript in einem eigenen Thread. Das misst V8 und den Speicherpfad dieser Maschine –
                Vergleiche mit C/Benchmarks anderer Tools sind deshalb nur grob gültig.
              </div>
            </Panel>
          </div>
        </>
      ) : (
        !running && (
          <EmptyState title="Noch kein Benchmark ausgeführt">
            Der Test misst diesen Rechner und stellt ihn dann in Diagrammen gegenüber. Er verändert nichts am System, lässt sich
            jederzeit abbrechen und braucht keine Administratorrechte.
          </EmptyState>
        )
      )}

      <Panel
        code="VERL"
        title="Eigene Läufe im Verlauf"
        right={
          history.length > 0 ? (
            <button type="button" className="btn" onClick={() => void clearBenchHistory()}>
              Verlauf löschen
            </button>
          ) : undefined
        }
      >
        {history.length === 0 ? (
          <EmptyState title="Noch keine Historie">
            Jeder abgeschlossene Lauf wird gespeichert und erscheint hier als Kurve. So siehst du, ob sich Temperaturschutz,
            Updates oder ein neuer Treiber auf die Leistung auswirken. Die Daten liegen ausschließlich lokal.
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile
                label="Bester Score"
                value={num(Math.max(...history.map((h) => h.score)))}
                unit="Punkte"
                tone="good"
                hint={`${history.length} Läufe gespeichert`}
              />
              <StatTile
                label="Mittelwert"
                value={num(history.reduce((sum, h) => sum + h.score, 0) / history.length)}
                unit="Punkte"
                hint="aus allen gespeicherten Läufen"
              />
              <StatTile
                label="Beste Gleitkomma"
                value={siValue(Math.max(...history.map((h) => h.floatFlops)), 'FLOPS')}
                hint="höchster Einzelwert"
              />
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <LiveChart
                height={170}
                currentLabel="jetzt"
                times={history.map((h) => h.at)}
                series={[
                  {
                    id: 'score',
                    label: 'Inspekt-Score',
                    color: SERIES_COLORS[0],
                    unit: 'Punkte',
                    values: history.map((h) => h.score),
                  },
                  {
                    id: 'gflops',
                    label: 'Gleitkomma',
                    color: SERIES_COLORS[1],
                    unit: 'GFLOPS',
                    values: history.map((h) => h.floatFlops / 1e9),
                  },
                ]}
              />
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <DataTable
                headers={['Zeitpunkt', 'Score', 'Gleitkomma', 'Bandbreite', 'RAM-Latenz', 'Laufzeit']}
                rows={[...history]
                  .slice(-12)
                  .reverse()
                  .map((h) => {
                    const ram = h.latency?.[h.latency.length - 1]?.ns
                    return [
                      new Date(h.at).toLocaleString('de-DE'),
                      num(h.score),
                      siValue(h.floatFlops, 'FLOPS'),
                      bytes(h.memCopyBytesPerSec ?? h.memBytesPerSec),
                      ram === undefined ? '—' : `${num(ram, 1)} ns`,
                      `${num(h.ms)} ms`,
                    ]
                  })}
              />
              {history.length > 12 && (
                <p className="mt-3 font-mono text-[10.5px] text-faint">die letzten 12 von {history.length} Läufen</p>
              )}
            </div>
          </>
        )}
      </Panel>

      <Panel code="CMP" title="Rechner im Vergleich – Spitzenleistung (Log10)">
        <ChartFrame titel="Spitzenleistung im Vergleich" hinweis={`${REFERENCE_MACHINES.length} Referenzrechner · Log10-Achse`}>
          <BarLog rows={barRows} empty="Noch keine Vergleichswerte." />
        </ChartFrame>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line pt-3 font-mono text-[10.5px] text-faint">
          <span>{REFERENCE_MACHINES.length} Referenzrechner</span>
          <span>≈ Schätzwert aus Taktrate/MIPS</span>
          <span>◇ veröffentlichter Herstellerwert</span>
          <span>{result ? `Messwerte über ${decades} Größenordnungen` : 'starte den Benchmark, um den eigenen Balken zu sehen'}</span>
        </div>
      </Panel>

      <Panel code="QUEL" title="Quellen der Referenzwerte">
        <p className="text-[12.5px] leading-relaxed text-muted">
          Jeder Referenzwert lässt sich gegen seine Herkunft prüfen. Der Link öffnet den Standardbrowser – Inspekt selbst
          bleibt dabei offline.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {REFERENCE_MACHINES.filter((m) => m.source).map((m) => (
            <button
              key={m.id}
              type="button"
              className="rounded border border-line bg-panel2 px-2 py-1 font-mono text-[10.5px] text-muted transition-colors hover:border-accent/50 hover:text-accent"
              onClick={() => void window.inspekt?.openExternal(m.source?.url ?? '')}
              title={`${m.name}: ${m.source?.url}`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </Panel>

      <Panel code="HIST" title="Zeitachse – Baujahr gegen Leistung">
        <ChartFrame titel="Baujahr gegen Spitzenleistung" hinweis="logarithmisch auf beiden Achsen">
          <ScatterLog
            points={scatterPoints}
            labelIds={['eniac', 'cray1', 'c64', 'pentium66', 'p3', 'ps5', 'rtx4090', 'frontier']}
          />
        </ChartFrame>
        <div className="mt-3 border-t border-line pt-3 font-mono text-[10.5px] text-faint">
          Die Zeitachse ist linear, die Leistungsachse logarithmisch. Gestrichelte Punkte sind Schätzungen, der eigene
          Rechner pulsiert. Detailtext erscheint beim Überfahren eines Punktes.
        </div>
      </Panel>

      <Panel code="TIME" title="Zeitvergleich – was die Referenz für 1 Sekunde dieses Rechners braucht">
        {timeItems.length > 0 ? (
          <ChartFrame titel="Wie lange die Referenz für 1 Sekunde braucht" hinweis="Balkenlänge logarithmisch">
            <TimeBars items={timeItems} />
          </ChartFrame>
        ) : (
          <div className="rounded border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
            Nach dem Benchmark siehst du hier, wie lange ENIAC, Commodore 64 oder eine PlayStation 5 für dieselbe Rechnung
            bräuchten.
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel code="SKOR" title="Inspekt-Score – nachvollziehbar gerechnet">
          <div className="rounded border border-line bg-panel2 px-4 py-3 font-mono text-[13px] text-fg">
            score = 100 × ( F/F₀ · I/I₀ · H/H₀ · M/M₀ )<sup className="text-muted">1/4</sup>
          </div>
          <ul className="mt-3 space-y-1.5 font-mono text-[12px] text-muted">
            <li>F₀ Gleitkomma = {siValue(SCORE_BASELINE.float, 'FLOPS')}</li>
            <li>I₀ Ganzzahl = {siValue(SCORE_BASELINE.int, 'OPS')}</li>
            <li>H₀ SHA-256 = {int(SCORE_BASELINE.hash)} /s</li>
            <li>M₀ Bandbreite = {bytes(SCORE_BASELINE.mem)}/s</li>
          </ul>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            Das geometrische Mittel bestraft Extreme: Eine einzelne schnelle Kennzahl rettet den Score nicht, eine sehr
            langsame drückt ihn. Genau das soll er ausdrücken – ausgewogene Rechenkraft.
          </p>
        </Panel>

        <Panel code="METH" title="Einordnung">
          <div className="space-y-3 text-[12.5px] leading-relaxed text-muted">
            <p>
              Die Referenzwerte stammen aus veröffentlichten Herstellerangaben oder sind – markiert mit ≈ – aus Taktrate und
              MIPS grob abgeleitet. Sie zeigen Größenordnungen, keine Laborpräzision.
            </p>
            <p>
              Eine einzelne Messung schwankt: Hintergrunddienste, Netzwerk und Temperatur beeinflussen das Ergebnis um einige
              Prozent. Für Vergleiche bitte zweimal messen und den Mittelwert nehmen.
            </p>
            <p className="flex flex-wrap items-center gap-2 font-mono text-[11.5px] text-fg">
              <Gauge size={14} className="text-accent" aria-hidden="true" />
              Aufgabe {BENCH_TOTAL} · Laufzeit ≈ 5 s · Abbruch jederzeit möglich
            </p>
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{REFERENCE_MACHINES.length} Referenzrechner</Badge>
        <Badge>{decades} Größenordnungen</Badge>
        <Badge>{result ? `Score ${num(result.score)}` : 'kein Ergebnis'}</Badge>
        <Badge tone={running ? 'warn' : 'neutral'}>{running ? `läuft: ${progress?.label ?? ''}` : 'bereit'}</Badge>
        <span className="font-mono text-[11px] text-faint">Reihenfolge: {barTasks.join(' › ')}</span>
      </div>
    </div>
  )
}
