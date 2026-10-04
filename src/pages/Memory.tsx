import { MemoryStick } from 'lucide-react'
import { Badge, DataTable, KV, Notice, Panel, StatTile } from '../components/ui.tsx'
import { SlotMap } from '../components/SlotMap.tsx'
import { bytes, kb, mt, num, percent } from '../lib/format.ts'
import { errorCorrection, formFactor, memoryTypeShort } from '../lib/labels.ts'
import type { MemoryModule } from '../../shared/schema.ts'
import type { PageProps } from './PageProps.ts'

const JEDEC_MAX: Record<string, number> = { DDR3: 2134, DDR4: 3200, DDR5: 6400, LPDDR5: 6400 }

function profile(module: MemoryModule): { label: string; tone: 'good' | 'warn' | 'neutral' } {
  const type = memoryTypeShort(module.smbiosType) ?? ''
  const speed = module.speed ?? 0
  const jedec = JEDEC_MAX[type]
  const overVoltage = (module.voltageMv ?? 0) > (type.startsWith('DDR5') ? 1100 : type === 'DDR4' ? 1200 : 0)
  if (jedec && speed > jedec) return { label: `über JEDEC (${jedec})`, tone: 'warn' }
  if (overVoltage) return { label: 'erhöhte Spannung', tone: 'warn' }
  return { label: 'JEDEC-Standard', tone: 'good' }
}

export function MemoryPage({ snapshot, report }: PageProps): React.ReactNode {
  const mem = snapshot?.sections.memory.data ?? null
  const modules = mem?.modules ?? []
  const installed = modules.reduce((sum, m) => sum + (m.capacity ?? 0), 0)
  const visible = (mem?.totalVisibleKB ?? 0) * 1024
  const freeRam = (mem?.freePhysicalKB ?? 0) * 1024
  const maxCapacity = (mem?.maxCapacityKB ?? 0) * 1024
  const first = modules[0] ?? null
  const typeLabel = memoryTypeShort(first?.smbiosType) ?? 'unbekannt'

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Freie Plätze" value={report.dimm.free} unit={`/ ${report.dimm.total}`} hint="exakt aus dem SMBIOS gelesen" tone={report.dimm.free > 0 ? 'good' : 'default'} />
        <StatTile label="Verbaut" value={bytes(installed)} hint={`${modules.length} Modul${modules.length === 1 ? '' : 'e'} · ${typeLabel}`} />
        <StatTile label="Für Windows sichtbar" value={bytes(visible)} hint={`davon ${bytes(freeRam)} frei`} />
        <StatTile label="Maximal belegbar" value={maxCapacity ? bytes(maxCapacity) : '—'} hint={mem?.maxCapacityKB ? `${num((mem.maxCapacityKB * 1024) / 1024 ** 3, 0)} GB nach Hersteller` : undefined} />
      </div>

      <Panel code="MAP" title="DIMM-Belegung">
        <SlotMap report={report} />
      </Panel>

      <Panel code="MOD" title="Module im Detail">
        <DataTable
          headers={['Platz', 'Kapazität', 'Takt', 'Typ', 'Formfaktor', 'Spannung', 'Hersteller', 'Teilenummer', 'Profil']}
          rows={modules.map((m, i) => [
            <span className="text-accent">{`DIMM_${i + 1}`}</span>,
            bytes(m.capacity),
            `${mt(m.speed)}${m.configuredSpeed && m.configuredSpeed !== m.speed ? ` (konfiguriert ${mt(m.configuredSpeed)})` : ''}`,
            memoryTypeShort(m.smbiosType) ?? '—',
            formFactor(m.formFactor) ?? '—',
            m.voltageMv ? `${num(m.voltageMv / 1000, 2)} V` : '—',
            m.manufacturer ?? '—',
            m.partNumber ?? '—',
            (() => {
              const p = profile(m)
              return <Badge tone={p.tone}>{p.label}</Badge>
            })(),
          ])}
          empty="Keine Module gefunden."
        />
        <div className="mt-4 grid gap-4 border-t border-line pt-4 lg:grid-cols-2">
          <KV
            columns={2}
            items={[
              { label: 'Speicherkontroller', value: errorCorrection(mem?.errorCorrection) ?? '—' },
              { label: 'Ort des Arrays', value: mem?.arrayLocation === 3 ? 'Hauptplatine' : num(mem?.arrayLocation) },
              { label: 'Datenbreite', value: first?.dataWidth ? `${first.dataWidth} bit` : '—' },
              { label: 'Gesamtbreite', value: first?.totalWidth ? `${first.totalWidth} bit` : '—' },
            ]}
          />
          <div className="space-y-3">
            <Notice tone="neutral" title="Was „sichtbar“ bedeutet">
              Windows sieht {bytes(visible)}, die Module melden {bytes(installed)}. Der Unterschied ist für den integrierten
              Grafikprozessor und die Firmware reserviert – kein defekter Speicher.
            </Notice>
          </div>
        </div>
      </Panel>

      <Panel code="LOC" title="Physische Lage">
        <div className="grid gap-3 md:grid-cols-2">
          {modules.map((m, i) => (
            <div key={`${m.tag ?? i}`} className="flex items-start gap-4 rounded-lg border border-line bg-panel2 px-4 py-3.5">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded border border-accent/40 bg-accent/10 text-accent">
                <MemoryStick size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[12px] font-semibold tracking-[0.1em] text-accent">DIMM_{i + 1}</div>
                <div className="mt-1 truncate text-[14px] text-fg">{m.locator ?? m.tag ?? 'unbekannter Platz'}</div>
                <div className="mt-1 flex flex-wrap gap-2 font-mono text-[11px] text-faint">
                  <span>{m.bank ?? '—'}</span>
                  <span>·</span>
                  <span>Seriennummer {m.serialNumber ?? '—'}</span>
                  <span>·</span>
                  <span>Interleave {num(m.interleave)}</span>
                </div>
              </div>
            </div>
          ))}
          {modules.length === 0 && <div className="text-[13px] text-muted">Keine Module gemeldet.</div>}
        </div>
        <div className="mt-4 border-t border-line pt-4 font-mono text-[11px] text-faint">{report.note}</div>
      </Panel>

      <Panel code="RAM" title="Aktuelle Auslastung">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Belegt" value={bytes(Math.max(0, visible - freeRam))} hint={`von ${bytes(visible)}`} />
          <StatTile label="Frei" value={bytes(freeRam)} hint={visible ? percent(((visible - freeRam) / visible) * 100) + ' belegt' : undefined} />
          <StatTile label="Cache/Reserve" value={bytes(Math.max(0, installed - visible))} hint="für Hardware reserviert" />
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          Die Auslastung stammt aus dem letzten Einlesen von <span className="font-mono text-fg">Win32_OperatingSystem</span>. Für
          Werte in Echtzeit nutzt Inspekt die Live-Messung auf der Seite Sensoren.
        </p>
        <p className="mt-2 flex items-center gap-2 font-mono text-[11px] text-faint">
          <span>Quelle: Win32_PhysicalMemory · Win32_PhysicalMemoryArray · KB aus MaxCapacityEx</span>
          <span className="text-accent">·</span>
          <span>{kb(mem?.totalVisibleKB)} sichtbar</span>
        </p>
      </Panel>
    </div>
  )
}
