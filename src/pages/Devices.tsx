import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge, DataTable, EmptyState, Panel, StatTile } from '../components/ui.tsx'
import { deviceClass } from '../lib/labels.ts'
import { num } from '../lib/format.ts'
import type { PageProps } from './PageProps.ts'

const PAGE_SIZE = 120

export function DevicesPage({ snapshot }: PageProps): React.ReactNode {
  const data = snapshot?.sections.devices.data ?? null
  const items = data?.items ?? []
  const [query, setQuery] = useState('')
  const [cls, setCls] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const histogram = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      const label = deviceClass(item.class)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [items])

  const maxCount = histogram[0]?.[1] ?? 1

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (cls && deviceClass(item.class) !== cls) return false
      if (!q) return true
      return (
        (item.name ?? '').toLowerCase().includes(q) ||
        (item.pnpId ?? '').toLowerCase().includes(q) ||
        (item.service ?? '').toLowerCase().includes(q) ||
        (item.mfr ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, query, cls])

  const visible = filtered.slice(0, limit)
  const problems = items.filter((i) => (i.problem ?? 0) > 0)
  const hidden = items.filter((i) => i.present === false)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Geräte gesamt" value={data?.count ?? items.length} hint="Win32_PnPEntity" />
        <StatTile label="Klassen" value={histogram.length} hint={histogram[0]?.[0] ?? '—'} />
        <StatTile label="Mit Fehlern" value={problems.length} tone={problems.length > 0 ? 'bad' : 'good'} hint={problems[0]?.name ?? 'keine Probleme gemeldet'} />
        <StatTile label="Nicht aktiv" value={hidden.length} hint="als nicht vorhanden markiert" />
      </div>

      <Panel code="CLS" title="Verteilung nach Klasse">
        <div className="grid gap-2 md:grid-cols-2">
          {histogram.map(([label, count]) => (
            <button
              key={label}
              type="button"
              onClick={() => setCls((prev) => (prev === label ? null : label))}
              className={[
                'group flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                cls === label ? 'border-accent/50 bg-accent/10' : 'border-line bg-panel2 hover:border-accent/40',
              ].join(' ')}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[12.5px] text-fg">{label}</span>
                <span className="mt-1 block h-1.5 rounded-full bg-line">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (count / maxCount) * 100)}%` }} />
                </span>
              </span>
              <span className="w-9 shrink-0 text-right font-mono text-[13px] text-accent">{count}</span>
            </button>
          ))}
        </div>
        {cls && (
          <div className="mt-4 flex items-center gap-3">
            <Badge tone="accent">Filter: {cls}</Badge>
            <button type="button" className="btn" onClick={() => setCls(null)}>
              Filter aufheben
            </button>
          </div>
        )}
      </Panel>

      <Panel
        code="PNP"
        title={`Geliste Geräte${cls ? ` · ${cls}` : ''}`}
        right={
          <div className="flex items-center gap-2 rounded border border-line2 bg-panel2 px-2.5 py-1.5">
            <Search size={13} className="text-faint" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(PAGE_SIZE)
              }}
              placeholder="Name, Dienst, PNP-ID …"
              className="w-52 bg-transparent font-mono text-[12px] text-fg outline-none placeholder:text-faint"
              aria-label="Geräte durchsuchen"
            />
          </div>
        }
      >
        <DataTable
          headers={['Name', 'Klasse', 'Dienst', 'Status', 'PNP-ID']}
          rows={visible.map((d) => [
            <span className="flex items-center gap-2">
              <span className="truncate">{d.name ?? '—'}</span>
              {(d.problem ?? 0) > 0 && <Badge tone="bad">Fehler {d.problem}</Badge>}
            </span>,
            deviceClass(d.class),
            d.service ?? '—',
            d.present === false ? 'nicht aktiv' : (d.status ?? '—'),
            <span className="block max-w-[38ch] truncate text-faint" title={d.pnpId ?? ''}>{d.pnpId ?? '—'}</span>,
          ])}
          empty={query || cls ? 'Nichts gefunden – Filter anpassen.' : 'Keine Geräte gemeldet.'}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 font-mono text-[11.5px] text-faint">
          <span>
            {num(visible.length)} von {num(filtered.length)} Treffern
            {query ? ` für „${query}“` : ''}
          </span>
          {visible.length < filtered.length && (
            <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              Weitere {Math.min(PAGE_SIZE, filtered.length - visible.length)} laden
            </button>
          )}
        </div>
      </Panel>

      {problems.length > 0 && (
        <Panel code="ERR" title="Geräte mit Problemen">
          <DataTable
            headers={['Name', 'Klasse', 'Problemcode', 'Status']}
            rows={problems.map((p) => [
              p.name ?? '—',
              deviceClass(p.class),
              <span className="text-rose-500">{p.problem}</span>,
              p.status ?? '—',
            ])}
            empty="Keine Probleme."
          />
        </Panel>
      )}

      {items.length === 0 && <EmptyState title="Keine Geräteliste vorhanden">Der Gerätebereich wurde nicht gelesen.</EmptyState>}
    </div>
  )
}
