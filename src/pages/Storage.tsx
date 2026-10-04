import { HardDrive, ShieldAlert } from 'lucide-react'
import { MiniBars } from '../components/charts/Mini.tsx'
import { Badge, DataTable, EmptyState, KV, Meter, Notice, Panel, StatTile } from '../components/ui.tsx'
import { SlotMap } from '../components/SlotMap.tsx'
import { bytes, percent } from '../lib/format.ts'
import { healthLabel, healthTone } from '../lib/labels.ts'
import { freeStorageSlots } from '../lib/ports.ts'
import type { Disk, Partition } from '../../shared/schema.ts'
import type { PageProps } from './PageProps.ts'

function rolesLabel(p: Partition): string {
  const roles = [p.isBoot ? 'Start' : null, p.isSystem ? 'System' : null, p.isActive ? 'Aktiv' : null].filter(
    (r): r is string => Boolean(r),
  )
  return roles.length > 0 ? roles.join(' · ') : (p.type ?? '—')
}

function toneFor(value: string | null | undefined): 'good' | 'warn' | 'bad' | 'neutral' {
  const t = healthTone(value)
  return t === 'neutral' ? 'neutral' : t
}

function tileTone(value: string | null | undefined): 'default' | 'good' | 'warn' | 'bad' {
  const t = healthTone(value)
  return t === 'neutral' ? 'default' : t
}

function DiskCard({ disk, elevated, onElevate }: { disk: Disk; elevated: boolean | null; onElevate: () => void }): React.ReactNode {
  const size = disk.size ?? 0
  const parts = disk.partitions ?? []
  const withFree = parts.filter((p) => p.free !== null && p.free !== undefined)
  const totalFree = withFree.reduce((sum, p) => sum + (p.free ?? 0), 0)
  const used = size - totalFree

  return (
    <div className="rounded-lg border border-line bg-panel2 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <HardDrive size={16} className="text-accent" aria-hidden="true" />
            <h3 className="truncate font-mono text-[14px] font-semibold text-fg">{disk.model ?? `Datenträger ${disk.number}`}</h3>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="accent">{disk.busType ?? '—'}</Badge>
            <Badge>{disk.mediaType ?? '—'}</Badge>
            <Badge>{disk.partitionStyle ?? '—'}</Badge>
            <Badge tone={toneFor(disk.health)}>{healthLabel(disk.health) ?? '—'}</Badge>
            {disk.isBoot && <Badge tone="good">Startvolume</Badge>}
            {disk.isReadOnly && <Badge tone="warn">schreibgeschützt</Badge>}
            {disk.isOffline && <Badge tone="bad">offline</Badge>}
          </div>
        </div>
        <div className="text-right">
          <div className="eyebrow">Kapazität</div>
          <div className="mt-1 font-mono text-[24px] leading-none font-semibold text-fg">{bytes(size)}</div>
          <div className="mt-1.5 font-mono text-[11px] text-faint">Platte {disk.number}</div>
        </div>
      </div>

      <div className="mt-4">
        <Meter
          label={totalFree > 0 ? `Belegt · ${bytes(used)} frei: ${bytes(totalFree)}` : 'Belegt'}
          value={size > 0 ? (used / size) * 100 : 0}
          suffix="%"
          tone={size > 0 && used / size > 0.9 ? 'warn' : 'good'}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
        <DataTable
          headers={['Nr.', 'Laufwerk', 'Bezeichnung', 'Dateisystem', 'Größe', 'Frei', 'Rolle']}
          rows={parts.map((p) => [
            p.number ?? '—',
            p.letter ? `${p.letter}:` : '—',
            p.label ?? '—',
            p.fs ?? '—',
            bytes(p.size),
            p.free === null || p.free === undefined ? '—' : bytes(p.free),
            rolesLabel(p),
          ])}
          empty="Keine Partitionen gefunden."
        />
        <KV
          columns={1}
          items={[
            { label: 'Status', value: disk.status ?? '—' },
            { label: 'Firmware', value: disk.firmware ?? '—' },
            { label: 'Hersteller-Nr.', value: disk.serial ?? '—' },
            { label: 'Eindeutige ID', value: disk.uniqueId ?? '—' },
            { label: 'SMART-Details', value: disk.reliability ? `${disk.reliability.temperature ?? '—'} °C` : elevated === false ? 'Rechte fehlen' : 'nicht verfügbar' },
          ]}
        />
      </div>

      {disk.reliability && (
        <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Temperatur" value={disk.reliability.temperature !== null && disk.reliability.temperature !== undefined ? `${disk.reliability.temperature} °C` : '—'} />
          <StatTile label="Einschaltdauer" value={disk.reliability.powerOnHours !== null && disk.reliability.powerOnHours !== undefined ? `${disk.reliability.powerOnHours} h` : '—'} />
          <StatTile label="Lesefehler" value={disk.reliability.readErrors ?? '—'} />
          {disk.reliability.wear !== null && disk.reliability.wear !== undefined && (
            <StatTile label="Verschleiß" value={percent(disk.reliability.wear)} />
          )}
        </div>
      )}

      {!disk.reliability && elevated === false && (
        <div className="mt-5">
          <Notice
            tone="warn"
            title="SMART-Zähler benötigen erhöhte Rechte"
            action={
              <button type="button" className="btn" onClick={onElevate}>
                Als Administrator starten
              </button>
            }
          >
            Temperatur, Einschaltdauer und Fehlerzähler lesen Windows nur mit Administratorrechten aus. Status und Belegung
            sind bereits vollständig.
          </Notice>
        </div>
      )}
    </div>
  )
}

export function StoragePage({ snapshot, report, elevated, onElevate, settings, patchSettings }: PageProps): React.ReactNode {
  const sto = snapshot?.sections.storage.data ?? null
  const disks = sto?.disks ?? []
  const logical = sto?.logical ?? []
  const total = disks.reduce((sum, d) => sum + (d.size ?? 0), 0)
  const free = logical
    .filter((l) => l.type === 3)
    .reduce((sum, l) => sum + (l.free ?? 0), 0)
  const freeSlots = freeStorageSlots(report)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Freie Anschlüsse" value={freeSlots} unit={`/ ${report.m2.total + report.sata.total}`} hint={`${report.m2.free}× M.2 · ${report.sata.free}× SATA`} tone={freeSlots > 0 ? 'good' : 'default'} />
        <StatTile label="Verbaut" value={disks.length} unit="Laufwerk(e)" hint={disks.map((d) => d.busType).filter(Boolean).join(' · ') || '—'} />
        <StatTile label="Gesamtkapazität" value={bytes(total)} hint={`${bytes(free)} auf Volumen frei`} />
        <StatTile label="Gesundheit" value={disks[0] ? (healthLabel(disks[0].health) ?? '—') : '—'} tone={tileTone(disks[0]?.health)} hint={sto?.reliabilityAvailable ? 'SMART verfügbar' : 'Status gemeldet'} />
      </div>

      <Panel
        code="MAP"
        title="Anschlüsse"
        right={
          <div className="flex items-center gap-2">
            <label className="eyebrow" htmlFor="m2-override">
              M.2 manuell
            </label>
            <input
              id="m2-override"
              type="number"
              min={0}
              max={8}
              value={settings.override.m2 ?? ''}
              placeholder="?"
              onChange={(e) => patchSettings({ override: { ...settings.override, m2: e.target.value === '' ? null : Number(e.target.value) } })}
              className="w-16 rounded border border-line2 bg-panel2 px-2 py-1 font-mono text-[12px] text-fg"
            />
            <label className="eyebrow" htmlFor="sata-override">
              SATA manuell
            </label>
            <input
              id="sata-override"
              type="number"
              min={0}
              max={16}
              value={settings.override.sata ?? ''}
              placeholder="?"
              onChange={(e) => patchSettings({ override: { ...settings.override, sata: e.target.value === '' ? null : Number(e.target.value) } })}
              className="w-16 rounded border border-line2 bg-panel2 px-2 py-1 font-mono text-[12px] text-fg"
            />
          </div>
        }
      >
        <SlotMap report={report} />
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          Windows kennt keine Anschlusszählung. Belegte Plätze sind exakt, die Gesamtzahl ist eine Schätzung nach Chassistyp –
          trage die tatsächliche Zahl ein, sobald du das Gerät geöffnet hast.
        </p>
      </Panel>

      <Panel code="USE" title="Belegung der logischen Volumen">
        <MiniBars
          max={100}
          items={logical
            .filter((l) => (l.size ?? 0) > 0)
            .map((l, i) => {
              const usedPct = (((l.size ?? 0) - (l.free ?? 0)) / (l.size ?? 1)) * 100
              return {
                id: `${l.letter ?? i}`,
                label: `${l.letter ?? '—'}: ${l.label ?? l.fs ?? 'Volumen'}`,
                value: usedPct,
                display: percent(usedPct),
                hint: `${bytes(l.size ?? 0)} gesamt · ${bytes(l.free ?? 0)} frei`,
                color: usedPct > 90 ? '#f43f5e' : usedPct > 75 ? '#f59e0b' : undefined,
              }
            })}
          empty="Keine Volumen mit Belegungsangabe gefunden."
        />
        <p className="mt-3 border-t border-line pt-3 font-mono text-[10.5px] text-faint">
          Amber ab 75 %, rot ab 90 % Auslastung · Werte live aus dem Dateisystem
        </p>
      </Panel>

      <Panel code="DSK" title="Datenträger">
        <div className="space-y-5">
          {disks.map((d) => (
            <DiskCard key={`${d.number}-${d.model}`} disk={d} elevated={elevated} onElevate={onElevate} />
          ))}
          {disks.length === 0 && <EmptyState title="Keine Datenträger gefunden">Der Speicherbereich liefert keine Datenträger. Prüfe die Fehlermeldung oben.</EmptyState>}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel code="VOL" title="Logische Volumen">
          <DataTable
            headers={['Laufwerk', 'Bezeichnung', 'Dateisystem', 'Größe', 'Frei', 'Status']}
            rows={logical.map((l) => [
              l.letter ? `${l.letter}:` : '—',
              l.label ?? '—',
              l.fs ?? '—',
              bytes(l.size),
              bytes(l.free),
              l.status ?? '—',
            ])}
            empty="Keine Volumen gefunden."
          />
        </Panel>

        <Panel code="CTL" title="Speichercontroller">
          <DataTable
            headers={['Name', 'Hersteller', 'Status', 'PNP-ID']}
            rows={(sto?.controllers ?? []).map((c) => [c.name ?? '—', c.manufacturer ?? '—', c.status ?? '—', c.pnpId ?? '—'])}
            empty="Keine Controller gefunden."
          />
        </Panel>
      </div>

      {(sto?.enclosures ?? []).length > 0 && (
        <Panel code="ENC" title="Gehäuse / Slots">
          <DataTable
            headers={['Name', 'Modell', 'Seriennummer', 'Firmware', 'Belegte Slots', 'Status']}
            rows={(sto?.enclosures ?? []).map((e) => [
              e.name ?? '—',
              e.model ?? '—',
              e.serial ?? '—',
              e.firmware ?? '—',
              e.slotCount ?? '—',
              e.health ?? e.state ?? '—',
            ])}
          />
        </Panel>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-line bg-panel2 px-4 py-3.5">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
        <p className="text-[13px] leading-relaxed text-muted">
          Werte stammen aus <span className="font-mono text-fg">MSFT_PhysicalDisk</span>,{' '}
          <span className="font-mono text-fg">Win32_DiskDrive</span> und den Volumen-APIs. Belegungsgrad von Volumen wird live aus
          dem Dateisystem berechnet.
        </p>
      </div>
    </div>
  )
}
