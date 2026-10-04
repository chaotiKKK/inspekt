import { Cpu, HardDrive, MemoryStick, Thermometer } from 'lucide-react'
import { LiveChart, SERIES_COLORS } from '../components/charts/LiveChart.tsx'
import { KV, Meter, Notice, Panel, Ring, StatTile } from '../components/ui.tsx'
import { SlotMap } from '../components/SlotMap.tsx'
import { bytes, celsius, duration, mhz, num, percent } from '../lib/format.ts'
import { chassisLabel, healthTone } from '../lib/labels.ts'
import { freeStorageSlots } from '../lib/ports.ts'
import type { PageProps } from './PageProps.ts'

export function OverviewPage({ snapshot, report, telemetry, elevated, onElevate }: PageProps): React.ReactNode {
  const sys = snapshot?.sections.system.data ?? null
  const cpu = snapshot?.sections.cpu.data ?? null
  const mem = snapshot?.sections.memory.data ?? null
  const sto = snapshot?.sections.storage.data ?? null
  const gpuSec = snapshot?.sections.gpu.data ?? null
  const tick = telemetry.tick

  const dimmFree = report.dimm.free
  const storageFree = freeStorageSlots(report)
  const installed = (mem?.modules ?? []).reduce((sum, m) => sum + (m.capacity ?? 0), 0)
  const disks = sto?.disks ?? []
  const totalDisk = disks.reduce((sum, d) => sum + (d.size ?? 0), 0)
  const health = disks.map((d) => d.health).filter(Boolean)[0] ?? null
  const nvidia = gpuSec?.nvidia ?? null

  const memUsedPct =
    mem && mem.totalVisibleKB && mem.freePhysicalKB !== null && mem.freePhysicalKB !== undefined
      ? ((mem.totalVisibleKB - mem.freePhysicalKB) / mem.totalVisibleKB) * 100
      : null

  return (
    <div className="space-y-5">
      <section className="panel relative overflow-hidden px-6 py-6">
        <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden="true" />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="eyebrow">{sys?.manufacturer ?? 'System'} · {chassisLabel(sys?.chassisTypes) ?? 'Chassis'}</div>
            <h2 className="mt-2 font-mono text-[30px] leading-none font-semibold tracking-tight text-fg">{sys?.model ?? 'Unbekanntes System'}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">{sys?.hostname ?? '—'}</span>
              <span className="chip">SN {sys?.serialNumber ?? '—'}</span>
              <span className="chip">{sys?.osCaption ?? '—'}</span>
              <span className="chip">{sys?.firmwareType ?? '—'}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="eyebrow">Laufzeit</div>
            <div className="mt-1.5 font-mono text-[26px] leading-none font-semibold text-fg">{duration(sys?.uptimeSec)}</div>
            <div className="mt-1.5 font-mono text-[11px] text-faint">seit {new Date(sys?.lastBoot ?? Date.now()).toLocaleString('de-DE')}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Freie DIMM-Plätze"
          value={dimmFree}
          unit={`/ ${report.dimm.total}`}
          hint={`${report.dimm.used} belegt · ${bytes(installed)} verbaut`}
          tone={dimmFree > 0 ? 'good' : 'default'}
        />
        <StatTile
          label="Freie Anschlüsse"
          value={storageFree}
          unit={`/ ${report.m2.total + report.sata.total}`}
          hint={`${report.m2.free}× M.2 · ${report.sata.free}× SATA`}
          tone={storageFree > 0 ? 'good' : 'default'}
        />
        <StatTile label="Datenträger" value={disks.length} unit={disks.length === 1 ? 'Laufwerk' : 'Laufwerke'} hint={bytes(totalDisk)} />
        <StatTile
          label="GPU-Temperatur"
          value={tick?.gpuTempC ?? nvidia?.tempC ?? null ? celsius(tick?.gpuTempC ?? nvidia?.tempC) : '—'}
          hint={nvidia ? nvidia.name : gpuSec?.nvidiaError ?? 'keine NVIDIA-Karte'}
          tone={(tick?.gpuTempC ?? nvidia?.tempC ?? 0) > 80 ? 'warn' : 'default'}
        />
      </div>

      <Panel code="MAP" title="Belegung: Arbeitsspeicher und Anschlüsse">
        <SlotMap report={report} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Panel code="LIVE" title="Live-Messung">
          {telemetry.error && (
            <div className="mb-4">
              <Notice tone="warn" title="Telemetrie unterbrochen">
                {telemetry.error}
              </Notice>
            </div>
          )}
          {!tick ? (
            <div className="grid place-items-center rounded border border-dashed border-line px-4 py-10 text-center">
              <div className="font-mono text-[13px] text-fg">Live-Messung noch nicht verfügbar</div>
              <div className="mt-1.5 max-w-[46ch] text-[13px] text-muted">
                Ein dauerhafter PowerShell-Prozess liefert CPU, Arbeitsspeicher, Datenträger, Netzwerk und GPU-Werte. In den
                Einstellungen abschaltbar.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-8">
                <Ring percent={tick.cpuLoadPercent} label="CPU-Auslastung" />
                <div className="min-w-[220px] flex-1 space-y-4">
                  <Meter
                    label="Arbeitsspeicher belegt"
                    value={tick.memoryTotalMB ? ((tick.memoryTotalMB - (tick.memoryFreeMB ?? 0)) / tick.memoryTotalMB) * 100 : memUsedPct}
                    suffix="%"
                  />
                  <Meter label="Datenträger-Auslastung" value={tick.diskPercent} suffix=" %" />
                  <Meter
                    label="GPU-Auslastung"
                    value={tick.gpuUtilPct ?? nvidia?.utilPct}
                    suffix="%"
                    tone={(tick.gpuUtilPct ?? 0) > 90 ? 'warn' : undefined}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                <div>
                  <div className="eyebrow">CPU</div>
                  <div className="mt-1 font-mono text-[16px] text-fg">{percent(tick.cpuLoadPercent)}</div>
                </div>
                <div>
                  <div className="eyebrow">RAM frei</div>
                  <div className="mt-1 font-mono text-[16px] text-fg">
                    {tick.memoryFreeMB !== null && tick.memoryFreeMB !== undefined ? bytes(tick.memoryFreeMB * 1024 * 1024) : '—'}
                  </div>
                </div>
                <div>
                  <div className="eyebrow">Netz ein</div>
                  <div className="mt-1 font-mono text-[16px] text-fg">{tick.rxBps !== null && tick.rxBps !== undefined ? `${num(tick.rxBps / 1024, 0)} kB/s` : '—'}</div>
                </div>
                <div>
                  <div className="eyebrow">GPU</div>
                  <div className="mt-1 font-mono text-[16px] text-fg">
                    {tick.gpuTempC !== null && tick.gpuTempC !== undefined ? celsius(tick.gpuTempC) : nvidia ? celsius(nvidia.tempC) : '—'}
                  </div>
                </div>
              </div>
              <div className="border-t border-line pt-4">
                <div className="eyebrow mb-2">Verlauf der letzten Minuten</div>
                <LiveChart
                  height={150}
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
                  ]}
                />
              </div>
            </div>
          )}
        </Panel>

        <Panel code="SYS" title="Kurzprofil">
          <KV
            columns={2}
            items={[
              { label: 'Prozessor', value: cpu?.name ?? '—', hint: cpu ? `${cpu.cores} Kerne · ${cpu.threads} Threads` : undefined },
              { label: 'Max. Takt', value: mhz(cpu?.items?.[0]?.maxClockMHz) },
              { label: 'Arbeitsspeicher', value: bytes(sys?.totalMemory), hint: `sichtbar ${bytes((mem?.totalVisibleKB ?? 0) * 1024)}` },
              { label: 'BIOS', value: `${sys?.biosVendor ?? '—'} ${sys?.biosVersion ?? ''}`.trim(), hint: sys?.biosDate ? new Date(sys.biosDate).toLocaleDateString('de-DE') : undefined },
              { label: 'Mainboard', value: `${sys?.boardMfr ?? '—'} ${sys?.boardProduct ?? ''}`.trim(), hint: sys?.boardVersion ?? undefined },
              { label: 'Datenträger-Status', value: health ?? '—' },
              { label: 'Windows-Build', value: sys?.osBuild ?? '—', hint: sys?.osArchitecture ?? undefined },
              { label: 'Seriennummer', value: sys?.serialNumber ?? '—' },
            ]}
          />
          <div className="mt-5 space-y-3 border-t border-line pt-4">
            <Meter
              label="RAM-Auslastung (Katalog)"
              value={memUsedPct}
              suffix="%"
              tone={memUsedPct && memUsedPct > 85 ? 'warn' : 'good'}
            />
            <div className="flex flex-wrap gap-2">
              <span className="chip">
                <MemoryStick size={12} aria-hidden="true" /> {report.dimm.used}/{report.dimm.total} DIMM
              </span>
              <span className="chip">
                <HardDrive size={12} aria-hidden="true" /> {report.m2.used}/{report.m2.total} M.2
              </span>
              <span className="chip">
                <Cpu size={12} aria-hidden="true" /> {cpu?.cores ?? '—'} Kerne
              </span>
              <span className="chip">
                <Thermometer size={12} aria-hidden="true" /> {nvidia ? celsius(nvidia.tempC) : '—'}
              </span>
              <span className={`chip border ${healthTone(health) === 'good' ? 'border-emerald-500/40 text-emerald-500' : 'border-line2'}`}>
                {health ?? '—'}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      {elevated === false && (
        <Notice tone="warn" title="Werte ohne erhöhte Rechte" action={<button className="btn" onClick={onElevate}>Als Administrator starten</button>}>
          CPU- und GPU-Temperaturen, SMART-Detailwerte und TPM-Status liegen hinter Administratorrechten. Die Belegung von
          Plätzen und Anschlüssen ist davon nicht betroffen.
        </Notice>
      )}
    </div>
  )
}
