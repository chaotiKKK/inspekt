import { useState } from 'react'
import { CellGrid } from '../components/charts/Mini.tsx'
import { LiveChart, SERIES_COLORS } from '../components/charts/LiveChart.tsx'
import { Badge, DataTable, EmptyState, Meter, Notice, Panel, Ring, Sparkline, StatTile } from '../components/ui.tsx'
import { bytes, celsius, num, percent, rate, watt } from '../lib/format.ts'
import type { PageProps } from './PageProps.ts'

export function SensorsPage({ snapshot, telemetry, elevated, onElevate, settings, patchSettings }: PageProps): React.ReactNode {
  const sensors = snapshot?.sections.sensors.data ?? null
  const tick = telemetry.tick
  const [copied, setCopied] = useState(false)

  const zones = sensors?.thermalZones ?? []
  const cpuHistory = telemetry.history.map((h) => h.cpuLoadPercent ?? 0)
  const gpuTempHistory = telemetry.history.map((h) => h.gpuTempC ?? 0)
  const memHistory = telemetry.history.map((h) => (h.memoryTotalMB ? ((h.memoryTotalMB - (h.memoryFreeMB ?? 0)) / h.memoryTotalMB) * 100 : 0))

  const memPct =
    tick && tick.memoryTotalMB
      ? ((tick.memoryTotalMB - (tick.memoryFreeMB ?? 0)) / tick.memoryTotalMB) * 100
      : sensors && sensors.memoryTotalMB
        ? ((sensors.memoryTotalMB - (sensors.memoryFreeMB ?? 0)) / sensors.memoryTotalMB) * 100
        : null

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="CPU-Auslastung" value={tick?.cpuLoadPercent ?? sensors?.cpuLoadPercent ?? null ? percent(tick?.cpuLoadPercent ?? sensors?.cpuLoadPercent) : '—'} hint="Performance-Zähler" />
        <StatTile label="Arbeitsspeicher" value={memPct !== null ? percent(memPct) : '—'} hint={sensors?.memoryTotalMB ? `${num(sensors.memoryFreeMB ?? 0, 0)} MB frei` : undefined} />
        <StatTile label="GPU-Temperatur" value={tick?.gpuTempC !== null && tick?.gpuTempC !== undefined ? celsius(tick.gpuTempC) : '—'} hint={tick?.gpuFanPct !== null && tick?.gpuFanPct !== undefined ? `Lüfter ${percent(tick.gpuFanPct)}` : 'Lüfter wird nicht gemeldet'} />
        <StatTile label="Datenträger" value={tick?.diskPercent !== null && tick?.diskPercent !== undefined ? percent(tick.diskPercent) : '—'} hint={tick?.diskQueue !== null && tick?.diskQueue !== undefined ? `Warteschlange ${tick.diskQueue}` : 'Warteschlange —'} />
      </div>

      <Panel
        code="TREND"
        title="Verlauf – alle Kennzahlen im Bild"
        right={settings.telemetry ? <Badge tone="good">live</Badge> : <Badge>statisch</Badge>}
      >
        <LiveChart
          times={telemetry.history.map((h) => h.at)}
          series={[
            { id: 'cpu', label: 'CPU', color: SERIES_COLORS[0], unit: '%', values: telemetry.history.map((h) => h.cpuLoadPercent ?? null) },
            {
              id: 'mem',
              label: 'RAM',
              color: SERIES_COLORS[1],
              unit: '%',
              values: telemetry.history.map((h) =>
                h.memoryTotalMB ? ((h.memoryTotalMB - (h.memoryFreeMB ?? 0)) / h.memoryTotalMB) * 100 : null,
              ),
            },
            { id: 'gpu', label: 'GPU-Last', color: SERIES_COLORS[2], unit: '%', values: telemetry.history.map((h) => h.gpuUtilPct ?? null) },
            { id: 'gput', label: 'GPU-Temp.', color: SERIES_COLORS[3], unit: '°C', values: telemetry.history.map((h) => h.gpuTempC ?? null) },
            { id: 'net', label: 'Netz ein', color: SERIES_COLORS[4], unit: 'kB/s', values: telemetry.history.map((h) => (h.rxBps === null || h.rxBps === undefined ? null : h.rxBps / 1024)) },
          ]}
        />
        <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
          Jede Kurve hat ihren eigenen Maßstab, weil die Einheiten unterschiedlich sind (%, °C, kB/s). In der Legende steht der
          jeweilige Höchstwert im Fenster. Messpunkt alle 1,5 Sekunden.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel code="CPU" title="Prozessorlast" right={settings.telemetry ? <Badge tone="good">live</Badge> : <Badge>statisch</Badge>}>
          <div className="flex flex-wrap items-center gap-6">
            <Ring percent={tick?.cpuLoadPercent ?? sensors?.cpuLoadPercent ?? 0} label="aktuell" />
            <div className="min-w-[200px] flex-1 space-y-4">
              <Meter label="Auslastung" value={tick?.cpuLoadPercent ?? sensors?.cpuLoadPercent} suffix=" %" tone={(tick?.cpuLoadPercent ?? 0) > 85 ? 'warn' : 'good'} />
              <Meter label="Arbeitsspeicher belegt" value={memPct} suffix=" %" tone={memPct !== null && memPct > 85 ? 'warn' : 'good'} />
              <Meter label="Datenträger ausgelastet" value={tick?.diskPercent} suffix=" %" />
            </div>
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <div className="eyebrow mb-2">CPU-Verlauf</div>
            <Sparkline values={cpuHistory} height={70} />
          </div>
        </Panel>

        <Panel code="GPU" title="Grafik und Temperatur">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="eyebrow mb-2">GPU-Auslastung</div>
              <Sparkline values={telemetry.history.map((h) => h.gpuUtilPct ?? 0)} height={70} />
            </div>
            <div>
              <div className="eyebrow mb-2">GPU-Temperatur</div>
              <Sparkline values={gpuTempHistory} height={70} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
            {[
              ['GPU-Temp.', tick?.gpuTempC !== null && tick?.gpuTempC !== undefined ? celsius(tick.gpuTempC) : '—'],
              ['GPU-Last', tick?.gpuUtilPct !== null && tick?.gpuUtilPct !== undefined ? percent(tick.gpuUtilPct) : '—'],
              ['Speicher', tick?.gpuMemUsedMb !== null && tick?.gpuMemUsedMb !== undefined ? `${num(tick.gpuMemUsedMb)} / ${num(tick.gpuMemTotalMb ?? 0)} MiB` : '—'],
              ['Leistung', tick?.gpuPowerW !== null && tick?.gpuPowerW !== undefined ? watt(tick.gpuPowerW) : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="eyebrow">{label}</div>
                <div className="mt-1 font-mono text-[15px] text-fg">{value}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel code="TMP" title="Thermozonen">
          {sensors?.thermalError ? (
            <Notice
              tone="warn"
              title="Thermozonen benötigen Administratorrechte"
              action={
                <button type="button" className="btn" onClick={onElevate}>
                  Als Administrator starten
                </button>
              }
            >
              Windows meldet für diesen Bereich: <span className="font-mono">{sensors.thermalError.trim()}</span>. CPU- und
              GPU-Werte kommen stattdessen aus den Performance-Zählern und nvidia-smi und funktionieren ohne Erhöhung.
            </Notice>
          ) : zones.length === 0 ? (
            <EmptyState title="Keine Thermozonen gemeldet" />
          ) : (
            <>
              <CellGrid
                title="Zonentemperatur"
                cells={zones.map((z, i) => ({
                  id: `zone-${i}`,
                  label: (z.instance ?? `Zone ${i + 1}`).replace(/Thermal Zone/i, 'TZ'),
                  value: celsius(z.celsius),
                  heat: z.celsius === null || z.celsius === undefined ? null : (z.celsius - 25) / 65,
                }))}
              />
              <div className="mt-4">
                <DataTable
                  headers={['Zone', 'Temperatur']}
                  rows={zones.map((z, i) => [z.instance ?? `Zone ${i + 1}`, celsius(z.celsius)])}
                  empty="Keine Zonen."
                />
              </div>
            </>
          )}

          <div className="mt-5 space-y-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Live-Messung</div>
                <div className="mt-1 text-[13px] text-muted">
                  Ein dauerhafter PowerShell-Prozess liefert alle 1,5 Sekunden neue Werte.
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  patchSettings({ telemetry: !settings.telemetry })
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1200)
                }}
              >
                {settings.telemetry ? 'Live-Messung stoppen' : 'Live-Messung starten'}
              </button>
            </div>
            {copied && <div className="font-mono text-[11px] text-accent">Einstellung übernommen.</div>}
            {telemetry.error && <Notice tone="warn" title="Telemetrie-Fehler">{telemetry.error}</Notice>}
          </div>
        </Panel>

        <Panel code="IO" title="Datenträger und Netzwerk (live)">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="eyebrow mb-2">Netzwerkverkehr</div>
              <div className="space-y-3">
                <Meter label="Empfang" value={tick?.rxBps ? Math.min(100, (tick.rxBps / (125 * 1024)) * 100) : 0} suffix=" %" />
                <div className="font-mono text-[13px] text-fg">{tick?.rxBps !== null && tick?.rxBps !== undefined ? rate(tick.rxBps) : '—'} ein</div>
                <Meter label="Sendung" value={tick?.txBps ? Math.min(100, (tick.txBps / (125 * 1024)) * 100) : 0} suffix=" %" />
                <div className="font-mono text-[13px] text-fg">{tick?.txBps !== null && tick?.txBps !== undefined ? rate(tick.txBps) : '—'} aus</div>
              </div>
            </div>
            <div>
              <div className="eyebrow mb-2">Arbeitsspeicher</div>
              <Sparkline values={memHistory} height={70} />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="eyebrow">Frei</div>
                  <div className="mt-1 font-mono text-[14px] text-fg">
                    {tick?.memoryFreeMB !== null && tick?.memoryFreeMB !== undefined ? bytes(tick.memoryFreeMB * 1024 * 1024) : '—'}
                  </div>
                </div>
                <div>
                  <div className="eyebrow">Gesamt</div>
                  <div className="mt-1 font-mono text-[14px] text-fg">
                    {tick?.memoryTotalMB !== null && tick?.memoryTotalMB !== undefined ? bytes(tick.memoryTotalMB * 1024 * 1024) : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-faint">
            <div>Laufzeit: {sensors?.uptimeSec ? `${Math.floor(sensors.uptimeSec / 3600)} Std.` : '—'} · Erhöhte Rechte:{' '}
              {sensors?.elevated ? 'ja' : 'nein'}</div>
            <div>Quellen: Win32_PerfFormattedData_PerfOS_Memory, PerfProc, PerfDisk, PerfTcpip, nvidia-smi</div>
          </div>
        </Panel>
      </div>

      {elevated === false && (
        <Notice tone="warn" title="Ohne erhöhte Rechte eingeschränkt" action={<button className="btn" onClick={onElevate}>Als Administrator starten</button>}>
          Alle hier gezeigten Werte funktionieren im Standardmodus. Nur die thermozonen-spezifischen Sensoren des
          Mainboards bleiben dunkel.
        </Notice>
      )}
    </div>
  )
}
