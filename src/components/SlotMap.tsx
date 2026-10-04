import { HardDrive, MemoryStick, Plus } from 'lucide-react'
import type { PortReport, PortSlot } from '../lib/ports.ts'
import { Badge } from './ui.tsx'

function SlotRow({ slot }: { slot: PortSlot }): React.ReactNode {
  const isMemory = slot.kind === 'dimm'
  const icon = isMemory ? MemoryStick : HardDrive
  const Icon = icon

  return (
    <div
      className={[
        'relative flex items-center gap-4 rounded-md px-4 py-3 transition-colors',
        slot.occupied
          ? 'border border-line2 bg-panel2'
          : 'border border-dashed border-accent/45 bg-transparent hover:bg-accent/5',
      ].join(' ')}
    >
      <span
        className={[
          'absolute inset-y-0 left-0 w-[3px] rounded-l-md',
          slot.occupied ? 'bg-accent' : 'bg-transparent',
        ].join(' ')}
        aria-hidden="true"
      />
      <span className="w-[74px] shrink-0 font-mono text-[11px] font-semibold tracking-[0.12em] text-accent">{slot.designator}</span>

      {slot.occupied ? (
        <>
          <Icon size={17} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-[13px] text-fg">{slot.occupiedBy}</span>
            {slot.detail && <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">{slot.detail}</span>}
          </span>
          <Badge tone="good">belegt</Badge>
        </>
      ) : (
        <>
          <Plus size={16} className="shrink-0 text-accent/70" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[13px] text-accent">freier Platz</span>
            <span className="mt-0.5 block truncate text-[12px] text-muted">kann erweitert werden</span>
          </span>
          <Badge tone="accent">frei</Badge>
        </>
      )}
    </div>
  )
}

function Group({
  code,
  title,
  slots,
  estimated,
}: {
  code: string
  title: string
  slots: PortSlot[]
  estimated: boolean
}): React.ReactNode {
  if (slots.length === 0) return null
  const free = slots.filter((s) => !s.occupied).length
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-accent">
          {code}
        </span>
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-fg">{title}</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <span className={`font-mono text-[11px] ${free > 0 ? 'text-accent' : 'text-faint'}`}>
          {slots.length - free} belegt · {free} frei
        </span>
        {estimated && <Badge tone="warn">Schätzung</Badge>}
      </div>
      <div className="grid gap-2">
        {slots.map((slot) => (
          <SlotRow key={slot.designator} slot={slot} />
        ))}
      </div>
    </div>
  )
}

/**
 * The signature element: DIMM, M.2 and SATA positions drawn the way they are
 * printed on a board — designator first, filled when something is in it.
 */
export function SlotMap({ report }: { report: PortReport }): React.ReactNode {
  const dimm = report.slots.filter((s) => s.kind === 'dimm')
  const m2 = report.slots.filter((s) => s.kind === 'm2')
  const sata = report.slots.filter((s) => s.kind === 'sata')

  return (
    <div className="rounded-lg border border-line bg-panel2/40 p-5">
      <div
        className="grid gap-6"
        style={{
          backgroundImage: 'linear-gradient(var(--c-line) 1px, transparent 1px), linear-gradient(90deg, var(--c-line) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          backgroundPosition: '-1px -1px',
          opacity: 1,
        }}
      >
        <div className="space-y-6 [grid-column:1/-1]">
          <Group code="DIMM" title={`Arbeitsspeicher · ${report.dimm.total} Plätze`} slots={dimm} estimated={false} />
          <Group code="M.2" title={`M.2-Anschlüsse · ${report.m2.total}`} slots={m2} estimated={report.basis !== 'manual' && report.m2.total > 0} />
          <Group code="SATA" title={`SATA-Anschlüsse · ${report.sata.total}`} slots={sata} estimated={report.basis !== 'manual' && report.sata.total > 0} />
        </div>
      </div>
      <p className="mt-5 border-t border-line pt-3 font-mono text-[11px] leading-relaxed text-faint">{report.note}</p>
    </div>
  )
}
