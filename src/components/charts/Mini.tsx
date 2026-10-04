import type { ReactNode } from 'react'

export interface MiniBarItem {
  id: string
  label: string
  value: number
  max?: number
  display?: string
  color?: string
  hint?: string
}

/** Schmale Balkenleiste für die bestehenden Seiten (Partitionen, Klassen, Takte …). */
export function MiniBars({
  items,
  max,
  empty = 'Keine Werte.',
  unitSuffix,
}: {
  items: MiniBarItem[]
  max?: number
  empty?: string
  unitSuffix?: string
}): ReactNode {
  const usable = items.filter((i) => Number.isFinite(i.value))
  if (usable.length === 0) return <div className="text-[12px] text-muted">{empty}</div>
  const top = max ?? Math.max(1, ...usable.map((i) => Math.abs(i.value)))

  return (
    <div className="space-y-1.5">
      {usable.map((item) => {
        const pct = Math.max(1, (Math.abs(item.value) / top) * 100)
        return (
          <div key={item.id} className="grid grid-cols-[minmax(80px,150px)_1fr_minmax(72px,auto)] items-center gap-3">
            <div className="truncate font-mono text-[11px] text-muted" title={item.hint}>
              {item.label}
            </div>
            <div className="h-2.5 rounded-[2px] bg-panel2 ring-1 ring-line ring-inset">
              <div
                className="h-full rounded-[2px]"
                style={{ width: `${pct}%`, background: item.color ?? 'var(--c-accent)' }}
              />
            </div>
            <div className="text-right font-mono text-[11px] text-fg">
              {item.display ?? item.value}
              {unitSuffix && <span className="text-faint"> {unitSuffix}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export interface GridCell {
  id: string
  label: string
  value?: string
  /** 0–1, steuert die Färbung; ohne Wert wird neutral gerendert */
  heat?: number | null
}

/** Raster aus Zellen – Kerne, Thermozonen, Geräteklassen. */
export function CellGrid({ cells, columns = 8, title }: { cells: GridCell[]; columns?: number; title?: string }): ReactNode {
  if (cells.length === 0) return null
  return (
    <div>
      {title && <div className="eyebrow mb-2">{title}</div>}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(64px, 1fr))` }} data-columns={columns}>
        {cells.map((cell) => {
          const heat = cell.heat === null || cell.heat === undefined || !Number.isFinite(cell.heat) ? null : Math.max(0, Math.min(1, cell.heat))
          return (
            <div
              key={cell.id}
              className="rounded border px-1.5 py-1.5 text-center"
              style={{
                borderColor: heat === null ? 'var(--c-line)' : `color-mix(in srgb, var(--c-accent) ${Math.round(25 + heat * 75)}%, var(--c-line))`,
                background: heat === null ? 'transparent' : `color-mix(in srgb, var(--c-accent) ${Math.round(6 + heat * 34)}%, transparent)`,
              }}
              title={cell.label}
            >
              <div className="truncate font-mono text-[10px] leading-tight text-faint">{cell.label}</div>
              <div className="font-mono text-[12px] leading-tight text-fg">{cell.value ?? ''}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
