import type { ReactNode } from 'react'

export interface ScatterPoint {
  id: string
  name: string
  year: number
  gflops: number
  highlight?: boolean
  estimated?: boolean
}

const fmt = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 3 })

/** Log-Log-Streudiagramm: Baujahr × Spitzenleistung, mit pulsierendem eigenen Marker. */
export function ScatterLog({ points, labelIds = [] }: { points: ScatterPoint[]; labelIds?: string[] }): ReactNode {
  const usable = points.filter((p) => Number.isFinite(p.year) && p.gflops > 0)
  if (usable.length === 0) return null

  const W = 900
  const H = 400
  const M = { top: 16, right: 22, bottom: 40, left: 62 }

  const years = usable.map((p) => p.year)
  const x0 = Math.floor(Math.min(...years) / 10) * 10
  const x1 = Math.ceil(Math.max(...years) / 10) * 10
  const logs = usable.map((p) => Math.log10(p.gflops))
  const y0 = Math.floor(Math.min(...logs))
  const y1 = Math.ceil(Math.max(...logs))

  const px = (year: number): number => M.left + ((year - x0) / Math.max(1, x1 - x0)) * (W - M.left - M.right)
  const py = (gflops: number): number => H - M.bottom - ((Math.log10(gflops) - y0) / Math.max(1, y1 - y0)) * (H - M.top - M.bottom)

  const xTicks: number[] = []
  for (let y = x0; y <= x1; y += x1 - x0 > 60 ? 20 : 10) xTicks.push(y)
  const yTicks: number[] = []
  for (let d = y0; d <= y1; d++) yTicks.push(d)

  const labelSet = new Set(labelIds)

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img" aria-label="Baujahr gegen Spitzenleistung, logarithmisch">
        {/* Gitter */}
        {yTicks.map((d) => (
          <g key={`y${d}`}>
            <line x1={M.left} x2={W - M.right} y1={py(10 ** d)} y2={py(10 ** d)} stroke="var(--c-line)" strokeWidth={1} />
            <text x={M.left - 8} y={py(10 ** d) + 3.5} textAnchor="end" fontSize={10} fill="var(--c-faint)" fontFamily="ui-monospace, monospace">
              10^{d}
            </text>
          </g>
        ))}
        {xTicks.map((y) => (
          <g key={`x${y}`}>
            <line x1={px(y)} x2={px(y)} y1={M.top} y2={H - M.bottom} stroke="var(--c-line)" strokeWidth={1} strokeDasharray="2 4" />
            <text x={px(y)} y={H - M.bottom + 16} textAnchor="middle" fontSize={10} fill="var(--c-faint)" fontFamily="ui-monospace, monospace">
              {y}
            </text>
          </g>
        ))}

        <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom} stroke="var(--c-line2)" strokeWidth={1.5} />
        <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="var(--c-line2)" strokeWidth={1.5} />

        {/* Punkte */}
        {[...usable]
          .sort((a, b) => a.gflops - b.gflops)
          .map((p) => {
            const x = px(p.year)
            const y = py(p.gflops)
            const own = p.highlight === true
            return (
              <g key={p.id} className={own ? 'scatter-own' : undefined}>
                {own && <circle cx={x} cy={y} r={13} fill="var(--c-accent)" opacity={0.22} className="pulse-ring" />}
                <circle
                  cx={x}
                  cy={y}
                  r={own ? 6 : 3.6}
                  fill={own ? 'var(--c-accent)' : p.estimated ? 'none' : 'var(--c-muted)'}
                  stroke={p.estimated || own ? 'var(--c-accent)' : 'none'}
                  strokeWidth={1.4}
                  strokeDasharray={p.estimated ? '2 2' : undefined}
                >
                  <title>{`${p.name} · ${p.year} · ${fmt.format(p.gflops)} GFLOPS${p.estimated ? ' (Schätzung)' : ''}`}</title>
                </circle>
                {(labelSet.has(p.id) || own) && (
                  <text
                    x={x + (own ? 10 : 7)}
                    y={y + (own ? -9 : 3.5)}
                    fontSize={own ? 11 : 9.5}
                    fontFamily="ui-monospace, monospace"
                    fill={own ? 'var(--c-accent)' : 'var(--c-faint)'}
                    fontWeight={own ? 700 : 400}
                  >
                    {own ? 'dieser Rechner' : p.name}
                  </text>
                )}
              </g>
            )
          })}

        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--c-faint)" fontFamily="ui-monospace, monospace">
          Baujahr
        </text>
        <text
          x={-(H / 2)}
          y={13}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize={10}
          fill="var(--c-faint)"
          fontFamily="ui-monospace, monospace"
        >
          Spitzenleistung in GFLOPS (log10)
        </text>
      </svg>
    </div>
  )
}
