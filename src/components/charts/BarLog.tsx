import type { ReactNode } from 'react'

export interface BarRow {
  id: string
  label: string
  value: number
  /** eigene Maschine – farblich hervorgehoben */
  highlight?: boolean
  /** Wert ist eine Schätzung, nicht eine Herstellerangabe */
  estimated?: boolean
  hint?: string
}

const fmt = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 4 })

/** `value` liegt in GFLOPS; ausgegeben wird die passende FLOPS-Einheit. */
export function formatGflops(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const flops = value * 1e9
  const steps: [number, string][] = [
    [1e12, ' TFLOPS'],
    [1e9, ' GFLOPS'],
    [1e6, ' MFLOPS'],
    [1e3, ' kFLOPS'],
    [1, ' FLOPS'],
  ]
  for (const [factor, unit] of steps) {
    if (flops >= factor) return `${fmt.format(flops / factor)}${unit}`
  }
  return `${fmt.format(flops)} FLOPS`
}

/**
 * Waagerechtes Balkendiagramm mit Log10-Achse – die einzige ehrliche Darstellung,
 * wenn acht Größenordnungen Unterschied in einem Bild liegen sollen.
 */
export function BarLog({ rows, empty = 'Noch keine Messwerte.' }: { rows: BarRow[]; empty?: string }): ReactNode {
  const usable = rows.filter((r) => Number.isFinite(r.value) && r.value > 0)
  if (usable.length === 0) {
    return <div className="rounded border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">{empty}</div>
  }

  const values = usable.map((r) => r.value)
  const logMin = Math.floor(Math.log10(Math.min(...values)))
  const logMax = Math.ceil(Math.log10(Math.max(...values)))
  const span = Math.max(1, logMax - logMin)
  const width = (v: number): number => ((Math.log10(v) - logMin) / span) * 100
  const decades: number[] = []
  for (let d = logMin; d <= logMax; d++) decades.push(d)

  const sorted = [...usable].sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-1.5">
      <div className="relative mb-2 h-4 border-b border-line2 pl-0">
        {decades.map((d) => (
          <span
            key={d}
            className="absolute bottom-0 -translate-x-1/2 font-mono text-[9.5px] text-faint"
            style={{ left: `${((d - logMin) / span) * 100}%` }}
          >
            10<sup>{d}</sup>
          </span>
        ))}
      </div>

      <div className="relative space-y-1.5">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {decades.map((d) => (
            <span
              key={d}
              className="absolute top-0 bottom-0 w-px bg-line"
              style={{ left: `${((d - logMin) / span) * 100}%` }}
            />
          ))}
        </div>

        {sorted.map((row) => (
          <div key={row.id} className="relative grid grid-cols-[minmax(96px,180px)_1fr_minmax(88px,auto)] items-center gap-3">
            <div className={`truncate font-mono text-[11.5px] ${row.highlight ? 'font-semibold text-accent' : 'text-muted'}`} title={row.hint}>
              {row.highlight && <span className="mr-1">▸</span>}
              {row.label}
            </div>
            <div className="relative h-4">
              <div
                className={`h-full rounded-[2px] transition-[width] duration-700 ease-out ${
                  row.highlight ? 'bg-accent shadow-[0_0_12px_var(--c-scan)]' : 'bg-accent/35'
                }`}
                style={{ width: `${Math.max(1.5, width(row.value))}%` }}
              />
            </div>
            <div className={`text-right font-mono text-[11px] ${row.highlight ? 'text-accent' : 'text-faint'}`}>
              {row.estimated && <span className="mr-0.5">≈</span>}
              {formatGflops(row.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 font-mono text-[10px] text-faint">
        Log10-Achse · schattierte Balken sind Schätzwerte (≈), ihr Marker steht rechts
      </div>
    </div>
  )
}
