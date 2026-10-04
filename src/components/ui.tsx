import type { ReactNode } from 'react'

export function Eyebrow({ children }: { children: ReactNode }): ReactNode {
  return <div className="eyebrow">{children}</div>
}

export function Panel({
  code,
  title,
  right,
  children,
  className = '',
}: {
  code?: string
  title?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}): ReactNode {
  return (
    <section className={`panel ${className}`}>
      {(title || code) && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {code && (
              <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-accent">
                {code}
              </span>
            )}
            {title && <h2 className="truncate font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-fg">{title}</h2>}
          </div>
          {right}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
}): ReactNode {
  const color =
    tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : tone === 'bad' ? 'text-rose-500' : 'text-fg'
  return (
    <div className="panel relative overflow-hidden px-4 py-3.5">
      <span className="absolute inset-y-0 left-0 w-[3px] bg-accent/70" aria-hidden="true" />
      <div className="eyebrow truncate">{label}</div>
      <div className={`mt-1.5 font-mono text-[26px] leading-none font-semibold tracking-tight ${color}`}>
        {value}
        {unit && <span className="ml-1 text-[13px] font-medium text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 truncate font-mono text-[11px] text-faint">{hint}</div>}
    </div>
  )
}

export interface KVItem {
  label: string
  value: ReactNode
  hint?: string
}

export function KV({ items, columns = 3 }: { items: KVItem[]; columns?: number }): ReactNode {
  const visible = items.filter((i) => i.value !== null && i.value !== undefined)
  if (visible.length === 0) return null
  return (
    <dl
      className="grid gap-x-8 gap-y-4"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(190px, 1fr))` }}
      data-columns={columns}
    >
      {visible.map((item, i) => (
        <div key={`${item.label}-${i}`} className="min-w-0 border-l border-line pl-3">
          <dt className="eyebrow truncate">{item.label}</dt>
          <dd className="mt-1 truncate font-mono text-[15px] text-fg" title={typeof item.value === 'string' ? item.value : undefined}>
            {item.value}
          </dd>
          {item.hint && <dd className="mt-0.5 truncate font-mono text-[11px] text-faint">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

export function Meter({
  value,
  max = 100,
  label,
  suffix = '%',
  tone,
}: {
  value: number | null | undefined
  max?: number
  label?: string
  suffix?: string
  tone?: 'good' | 'warn' | 'bad'
}): ReactNode {
  const pct = value === null || value === undefined || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  const color = tone === 'bad' ? 'bg-rose-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'good' ? 'bg-emerald-500' : 'bg-accent'
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="eyebrow truncate">{label}</span>
          <span className="font-mono text-[12px] text-muted">
            {value === null || value === undefined ? '—' : `${Math.round(value * 100) / 100}${suffix}`}
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-panel2 ring-1 ring-line ring-inset">
        <div className={`h-full rounded-full ${color} transition-[width] duration-500 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Ring({
  percent,
  center,
  label,
  size = 132,
}: {
  percent: number | null | undefined
  center?: ReactNode
  label?: string
  size?: number
}): ReactNode {
  const value = percent === null || percent === undefined || !Number.isFinite(percent) ? 0 : Math.max(0, Math.min(100, percent))
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${Math.round(value)} %`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-line)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(c * value) / 100} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray .6s cubic-bezier(.22,1,.36,1)' }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-mono text-[24px] leading-none font-semibold text-fg">{Math.round(value)}</div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.16em] text-faint">%</div>
          </div>
        </div>
      </div>
      {label && <div className="eyebrow">{label}</div>}
      {center}
    </div>
  )
}

export function Sparkline({
  values,
  height = 54,
  fill = true,
}: {
  values: number[]
  height?: number
  fill?: boolean
}): ReactNode {
  if (values.length < 2) {
    return (
      <div className="grid place-items-center rounded border border-dashed border-line font-mono text-[11px] text-faint" style={{ height }}>
        noch keine Verlaufsdaten
      </div>
    )
  }
  const width = 240
  const max = Math.max(100, ...values)
  const step = width / (values.length - 1)
  const points = values.map((v, i) => `${(i * step).toFixed(2)},${(height - (v / max) * (height - 6) - 3).toFixed(2)}`)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden="true">
      {fill && <polygon points={`0,${height} ${points.join(' ')} ${width},${height}`} fill="var(--c-accent)" opacity="0.14" />}
      <polyline points={points.join(' ')} fill="none" stroke="var(--c-accent)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'accent'

const TONES: Record<Tone, string> = {
  neutral: 'border-line2 text-muted',
  good: 'border-emerald-500/40 text-emerald-500',
  warn: 'border-amber-500/40 text-amber-500',
  bad: 'border-rose-500/40 text-rose-500',
  accent: 'border-accent/45 text-accent',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }): ReactNode {
  return <span className={`chip border ${TONES[tone]}`}>{children}</span>
}

export function Notice({
  tone = 'accent',
  title,
  children,
  action,
}: {
  tone?: Tone
  title: string
  children?: ReactNode
  action?: ReactNode
}): ReactNode {
  const border = tone === 'bad' ? 'border-rose-500/40' : tone === 'warn' ? 'border-amber-500/40' : 'border-accent/40'
  const text = tone === 'bad' ? 'text-rose-500' : tone === 'warn' ? 'text-amber-500' : 'text-accent'
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 rounded-lg border ${border} bg-panel2 px-4 py-3.5`}>
      <div className="min-w-0">
        <div className={`font-mono text-[12px] font-semibold tracking-[0.06em] ${text}`}>{title}</div>
        {children && <div className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-muted">{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function DataTable({
  headers,
  rows,
  empty = 'Keine Daten vorhanden.',
  align = 'left',
}: {
  headers: string[]
  rows: ReactNode[][]
  empty?: string
  align?: 'left' | 'right'
}): ReactNode {
  if (rows.length === 0) {
    return <div className="rounded border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">{empty}</div>
  }
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={h + i}
                className={`border-b border-line2 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint first:pl-0 ${
                  align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="transition-colors hover:bg-panel2">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={`border-b border-line px-3 py-2.5 align-top font-mono text-[12.5px] text-fg first:pl-0 ${
                    align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }): ReactNode {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <div className="font-mono text-[13px] font-semibold text-fg">{title}</div>
      {children && <div className="mx-auto mt-2 max-w-[52ch] text-[13px] leading-relaxed text-muted">{children}</div>}
    </div>
  )
}
