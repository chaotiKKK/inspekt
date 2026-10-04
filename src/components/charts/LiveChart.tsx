import type { ReactNode } from 'react'

export interface LiveSeries {
  id: string
  label: string
  color: string
  unit: string
  values: (number | null)[]
}

export const SERIES_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#38bdf8', '#f43f5e', '#e879f9']

const fmt = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 3 })

/**
 * Live-Verlaufschart mehrerer Kennzahlen mit Gitter, Zeitachse und eigener
 * Skalierung je Kurve – bei gemischten Einheiten (%) °C, GB/s) ist das die
 * einzig lesbare Variante; die Legende nennt den jeweiligen Höchstwert.
 */
export function LiveChart({
  series,
  times,
  height = 190,
  currentLabel = 'jetzt',
}: {
  series: LiveSeries[]
  times?: number[]
  height?: number
  currentLabel?: string
}): ReactNode {
  const visible = series.filter((s) => s.values.some((v) => v !== null && Number.isFinite(v)))
  if (visible.length === 0) {
    return (
      <div className="grid place-items-center rounded border border-dashed border-line font-mono text-[11px] text-faint" style={{ height }}>
        noch keine Verlaufsdaten
      </div>
    )
  }

  const W = 900
  const H = height
  const M = { top: 12, right: 12, bottom: 26, left: 40 }
  const count = Math.max(...visible.map((s) => s.values.length))

  const x = (i: number): number => M.left + (count <= 1 ? 0 : (i / (count - 1)) * (W - M.left - M.right))
  const y = (v: number, max: number): number => H - M.bottom - (max > 0 ? (v / max) : 0) * (H - M.top - M.bottom)

  const gridRows = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} role="img" aria-label="Verlaufsdiagramm">
        {gridRows.map((g) => {
          const yy = M.top + g * (H - M.top - M.bottom)
          return <line key={g} x1={M.left} x2={W - M.right} y1={yy} y2={yy} stroke="var(--c-line)" strokeWidth={1} />
        })}

        {visible.map((s) => {
          const max = Math.max(1, ...s.values.map((v) => (v !== null && Number.isFinite(v) ? v : 0)))
          const segments: string[] = []
          let open = false
          s.values.forEach((v, i) => {
            if (v === null || !Number.isFinite(v)) {
              open = false
              return
            }
            const point = `${x(i).toFixed(1)},${y(v, max).toFixed(1)}`
            if (open) segments[segments.length - 1] += ` ${point}`
            else segments.push(point)
            open = true
          })
          return (
            <g key={s.id}>
              {segments.map((seg, i) => (
                <polyline key={i} points={seg} fill="none" stroke={s.color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {segments.length === 1 && <circle cx={x(s.values.length - 1)} cy={y(Number(s.values[s.values.length - 1]), max)} r={2.5} fill={s.color} />}
            </g>
          )
        })}

        <text x={M.left} y={H - 8} fontSize={9.5} fill="var(--c-faint)" fontFamily="ui-monospace, monospace">
          {times && times.length > 0 ? `−${Math.round((Date.now() - times[0]) / 60000)} Min.` : ''}
        </text>
        <text x={W - M.right} y={H - 8} textAnchor="end" fontSize={9.5} fill="var(--c-faint)" fontFamily="ui-monospace, monospace">
          {currentLabel}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
        {visible.map((s) => {
          const max = Math.max(0, ...s.values.map((v) => (v !== null && Number.isFinite(v) ? v : 0)))
          const last = [...s.values].reverse().find((v): v is number => v !== null && Number.isFinite(v))
          return (
            <span key={s.id} className="flex items-center gap-2 font-mono text-[11px]">
              <span className="inline-block h-[3px] w-5 rounded-full" style={{ background: s.color }} />
              <span className="text-muted">{s.label}</span>
              <span className="text-fg">{last === undefined ? '—' : `${fmt.format(last)} ${s.unit}`}</span>
              <span className="text-faint">max {fmt.format(max)} {s.unit}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
