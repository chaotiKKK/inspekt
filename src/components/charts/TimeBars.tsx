import type { ReactNode } from 'react'

export interface TimeBarItem {
  id: string
  label: string
  /** Sekunden, die die Referenz für das braucht, was der eigene Rechner in 1 s schafft */
  seconds: number
  hint?: string
  highlight?: boolean
}

function human(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 1) {
    const ms = seconds * 1000
    if (ms >= 1) return `${ms < 10 ? ms.toFixed(2) : ms.toFixed(1)} ms`
    return `${(seconds * 1e6).toFixed(1)} µs`
  }
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} Sek.`
  if (seconds < 3600) return `${Math.round(seconds / 60)} Min.`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} Std.`
  if (seconds < 2592000) return `${Math.round(seconds / 86400)} Tage`
  if (seconds < 31536000) return `${Math.round(seconds / 2592000)} Monate`
  return `${(seconds / 31536000).toFixed(seconds > 3.1536e10 ? 0 : 1)} Jahre`
}

/**
 * „Dein Rechner schafft in 1 s, wofür die Referenz X braucht."
 * Balkenlänge logarithmisch, damit Millisekunden und Jahrtausende nebeneinander passen.
 */
export function TimeBars({ items, reference = 'Dieser Rechner' }: { items: TimeBarItem[]; reference?: string }): ReactNode {
  const usable = items.filter((i) => Number.isFinite(i.seconds) && i.seconds > 0)
  if (usable.length === 0) return null

  const all = [1, ...usable.map((i) => i.seconds)]
  const logMin = Math.log10(Math.min(...all))
  const logMax = Math.log10(Math.max(...all))
  const span = Math.max(1e-6, logMax - logMin)
  const width = (s: number): number => ((Math.log10(s) - logMin) / span) * 100

  const sorted = [...usable].sort((a, b) => b.seconds - a.seconds)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(96px,170px)_1fr_minmax(96px,auto)] items-center gap-3">
        <div className="font-mono text-[11.5px] font-semibold text-accent">{reference}</div>
        <div className="h-4">
          <div className="h-full min-w-[3px] rounded-[2px] bg-accent" style={{ width: `${Math.max(2, width(1))}%` }} />
        </div>
        <div className="text-right font-mono text-[11px] text-accent">1 Sek.</div>
      </div>

      {sorted.map((item) => (
        <div key={item.id} className="grid grid-cols-[minmax(96px,170px)_1fr_minmax(96px,auto)] items-center gap-3">
          <div className="truncate font-mono text-[11.5px] text-muted" title={item.hint}>
            {item.highlight && <span className="mr-1">▸</span>}
            {item.label}
          </div>
          <div className="h-4">
            <div
              className="h-full rounded-[2px] bg-accent/35 transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(2, width(item.seconds))}%` }}
            />
          </div>
          <div className="text-right font-mono text-[11px] text-fg">{human(item.seconds)}</div>
        </div>
      ))}

      <div className="pt-1 font-mono text-[10px] text-faint">
        Balkenlänge logarithmisch · Vergleichswert ist der gemessene Gleitkomma-Durchsatz dieses Rechners
      </div>
    </div>
  )
}
