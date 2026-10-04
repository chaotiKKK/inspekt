import { Cpu as CpuIcon } from 'lucide-react'
import { CellGrid } from '../components/charts/Mini.tsx'
import { KV, Meter, Panel, Ring, Sparkline, StatTile } from '../components/ui.tsx'
import { bytes, mhz, num, percent } from '../lib/format.ts'
import type { PageProps } from './PageProps.ts'

export function CpuPage({ snapshot, telemetry }: PageProps): React.ReactNode {
  const cpu = snapshot?.sections.cpu.data ?? null
  const item = cpu?.items?.[0] ?? null
  const sys = snapshot?.sections.system.data ?? null
  const tick = telemetry.tick
  const loadHistory = telemetry.history.map((h) => h.cpuLoadPercent ?? 0)

  const load = tick?.cpuLoadPercent ?? item?.loadPercent ?? 0
  const coreCount = cpu?.cores ?? 0

  return (
    <div className="space-y-5">
      <section className="panel relative overflow-hidden px-6 py-6">
        <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden="true" />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="eyebrow">{item?.manufacturer ?? 'Prozessor'} · {item?.socket ?? 'Sockel unbekannt'}</div>
            <h2 className="mt-2 font-mono text-[26px] leading-tight font-semibold tracking-tight text-fg">{cpu?.name ?? 'Unbekannt'}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">{item?.arch ?? sys?.osArchitecture ?? '—'}</span>
              <span className="chip">{cpu?.count ?? 1}× physisch</span>
              {item?.virtualization && <span className="chip">Virtualisierung aktiv</span>}
              {item?.slat && <span className="chip">SLAT</span>}
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <div className="font-mono text-[40px] leading-none font-semibold text-accent">{cpu?.cores ?? '—'}</div>
              <div className="eyebrow mt-2">Kerne</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[40px] leading-none font-semibold text-fg">{cpu?.threads ?? '—'}</div>
              <div className="eyebrow mt-2">Threads</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Max. Takt" value={item?.maxClockMHz ? num(item.maxClockMHz) : '—'} unit="MHz" hint={item?.currentClockMHz ? `aktuell ${num(item.currentClockMHz)} MHz` : undefined} />
        <StatTile label="Cache L2" value={bytes((item?.l2CacheKB ?? 0) * 1024)} hint={item?.l3CacheKB ? `L3 ${bytes(item.l3CacheKB * 1024)}` : undefined} />
        <StatTile label="Aktuelle Auslastung" value={tick?.cpuLoadPercent ?? item?.loadPercent ?? null ? percent(tick?.cpuLoadPercent ?? item?.loadPercent) : '—'} hint="Live aus der Telemetrie" />
        <StatTile label="Kerne aktiv" value={`${item?.coresEnabled ?? cpu?.cores ?? '—'} / ${item?.cores ?? cpu?.cores ?? '—'}`} hint={item?.cores189 ? `${item.cores189} laut BIOS` : 'Sockets: ' + num(sys?.sockets)} />
      </div>

      {coreCount > 0 && (
        <Panel code="CORE" title="Kerne im Raster">
          <CellGrid
            title={`Gesamtlast ${percent(load)} · keine Einzelkernwerte`}
            cells={Array.from({ length: coreCount }, (_, i) => ({
              id: `core-${i}`,
              label: `K${i}`,
              value: `${Math.round(load)}%`,
              heat: load / 100,
            }))}
          />
          <p className="mt-3 border-t border-line pt-3 font-mono text-[10.5px] text-faint">
            Die Färbung zeigt die Auslastung des gesamten Prozessors – Windows liefert für diese Ansicht keine
            Kern-Einzelwerte. SMT-Threads werden hier nicht doppelt gezählt.
          </p>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Panel code="LOAD" title="Auslastung">
          <Ring percent={tick?.cpuLoadPercent ?? item?.loadPercent ?? 0} label="CPU gesamt" />
          <div className="mt-5 border-t border-line pt-4">
            <div className="eyebrow mb-2">Verlauf</div>
            <Sparkline values={loadHistory} />
            <div className="mt-1.5 font-mono text-[11px] text-faint">letzte {loadHistory.length} Messwerte · alle 1,5 s</div>
          </div>
        </Panel>

        <Panel code="CPU" title="Details">
          <KV
            items={[
              { label: 'Modell', value: cpu?.name ?? '—' },
              { label: 'Hersteller', value: item?.manufacturer ?? '—' },
              { label: 'Beschreibung', value: item?.description ?? '—' },
              { label: 'Sockel / Gehäuse', value: item?.socket ?? '—' },
              { label: 'Architektur', value: item?.arch ?? '—' },
              { label: 'Stepping / Revision', value: [item?.stepping, item?.revision].filter(Boolean).join(' / ') || '—' },
              { label: 'Prozessor-ID', value: item?.processorId ?? '—' },
              { label: 'Status', value: item?.status ?? '—' },
              { label: 'Max. Takt', value: mhz(item?.maxClockMHz) },
              { label: 'Aktueller Takt', value: mhz(item?.currentClockMHz) },
              { label: 'L2-Cache', value: bytes((item?.l2CacheKB ?? 0) * 1024) },
              { label: 'L3-Cache', value: bytes((item?.l3CacheKB ?? 0) * 1024) },
              { label: 'Virtualisierung', value: item?.virtualization === null || item?.virtualization === undefined ? '—' : item.virtualization ? 'unterstützt' : 'nicht verfügbar' },
              { label: 'SLAT (EPT/RVI)', value: item?.slat === null || item?.slat === undefined ? '—' : item.slat ? 'vorhanden' : 'nicht vorhanden' },
              { label: 'Kerne aktiv', value: item?.coresEnabled === null || item?.coresEnabled === undefined ? '—' : `${item.coresEnabled} von ${item.cores}` },
            ]}
          />
          <div className="mt-5 space-y-4 border-t border-line pt-4">
            <Meter label="Kerne aktiv" value={item?.cores && item?.coresEnabled ? (item.coresEnabled / item.cores) * 100 : 100} suffix=" %" tone="good" />
            <Meter label="Auslastung" value={tick?.cpuLoadPercent ?? item?.loadPercent} suffix=" %" tone={(tick?.cpuLoadPercent ?? 0) > 85 ? 'warn' : 'good'} />
          </div>
        </Panel>
      </div>

      {(cpu?.items?.length ?? 0) > 1 && (
        <Panel code="SCK" title="Sockel">
          <KV
            items={(cpu?.items ?? []).map((c, i) => ({
              label: `Sockel ${i + 1}`,
              value: `${c.name ?? '—'}`,
              hint: `${c.cores ?? '—'} Kerne · ${c.threads ?? '—'} Threads · ${mhz(c.maxClockMHz)}`,
            }))}
          />
        </Panel>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-line bg-panel2 px-4 py-3.5">
        <CpuIcon size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
        <p className="text-[13px] leading-relaxed text-muted">
          Kerne, Threads und Caches stammen aus <span className="font-mono text-fg">Win32_Processor</span>. Der Takt wird bei jedem
          Einlesen neu abgefragt und schwankt je nach Last – das ist normal.
        </p>
      </div>
    </div>
  )
}
