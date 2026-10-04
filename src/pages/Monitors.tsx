import { CellGrid } from '../components/charts/Mini.tsx'
import { Badge, DataTable, EmptyState, KV, Panel, StatTile } from '../components/ui.tsx'
import { num } from '../lib/format.ts'
import { monitorOutputLabel } from '../lib/labels.ts'
import type { PageProps } from './PageProps.ts'

export function MonitorsPage({ snapshot }: PageProps): React.ReactNode {
  const monitorData = snapshot?.sections.monitors.data ?? null
  const monitors = monitorData?.monitors ?? []
  const active = monitors.filter((m) => m.active !== false)
  const modes = (monitorData?.displayModes ?? []).filter((m) => (m.width ?? 0) > 0 && (m.height ?? 0) > 0)
  const bestMode = modes.reduce<(typeof modes)[number] | null>((best, m) => {
    if (!best) return m
    const refreshBonus = (m.refreshHz ?? 0) > 0 ? 1 : 0
    const bestBonus = (best.refreshHz ?? 0) > 0 ? 1 : 0
    if (refreshBonus !== bestBonus) return refreshBonus > bestBonus ? m : best
    if ((m.width ?? 0) > (best.width ?? 0)) return m
    if ((m.width ?? 0) === (best.width ?? 0) && (m.height ?? 0) > (best.height ?? 0)) return m
    return best
  }, null)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Angeschlossen" value={active.length} unit={active.length === 1 ? 'Bildschirm' : 'Bildschirme'} hint={`${monitors.length} insgesamt erkannt`} />
        <StatTile label="Größte Diagonale" value={monitors.length ? `${num(Math.max(...monitors.map((m) => m.diagonalIn ?? 0)), 1)}"` : '—'} hint="aus EDID berechnet" />
        <StatTile label="Ältestes Baujahr" value={monitors.length ? String(Math.min(...monitors.map((m) => m.year ?? 9999))) : '—'} hint="EDID-Feld year" />
        <StatTile label="Hersteller" value={[...new Set(monitors.map((m) => m.manufacturer).filter(Boolean))].join(' · ') || '—'} />
      </div>

      {monitors.length > 0 && (
        <Panel code="SIZE" title="Bildschirmgrößen im Überblick">
          <CellGrid
            cells={monitors.map((m, i) => ({
              id: `mon-${i}`,
              label: `${m.manufacturer ?? 'Display'} ${i + 1}`,
              value: m.diagonalIn ? `${num(m.diagonalIn, 1)}"` : '—',
              heat: m.diagonalIn ? (m.diagonalIn - 13) / 30 : null,
            }))}
          />
          <p className="mt-3 font-mono text-[10.5px] text-faint">Färbung nach Diagonale · Werte aus dem EDID</p>
        </Panel>
      )}

      {monitors.length === 0 && (
        <EmptyState title="Keine Monitore gefunden">
          Windows hat keine EDID-Daten geliefert. Bei externen Bildschirmen hilft es, das Kabel einmal abzuziehen und erneut
          anzuschließen.
        </EmptyState>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {monitors.map((m, i) => {
          const diagonal = m.diagonalIn
          const aspect = m.widthCm && m.heightCm ? ((m.widthCm / m.heightCm) * 2.54).toFixed(1) : null
          return (
            <div key={`${m.instance ?? i}`} className="relative overflow-hidden rounded-lg border border-line bg-panel2 px-5 py-5">
              <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden="true" />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="eyebrow">Display {i + 1}</div>
                  <h3 className="mt-1.5 truncate font-mono text-[17px] font-semibold text-fg">
                    {m.name || `${m.manufacturer ?? '—'} ${m.productCode ?? ''}`.trim()}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone={m.active !== false ? 'good' : 'neutral'}>{m.active !== false ? 'aktiv' : 'inaktiv'}</Badge>
                    <Badge tone="accent">{monitorOutputLabel(m.outputTech) ?? 'unbekannt'}</Badge>
                    {m.hdr === true && <Badge tone="accent">HDR</Badge>}
                    {m.videoInput && <Badge>{m.videoInput === 1 ? 'digital' : `Eingang ${m.videoInput}`}</Badge>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[34px] leading-none font-semibold text-accent">{diagonal ? num(diagonal, 1) : '—'}</div>
                  <div className="eyebrow mt-1.5">Zoll</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-5">
                {[
                  ['Breite', m.widthCm ? `${m.widthCm} cm` : '—'],
                  ['Höhe', m.heightCm ? `${m.heightCm} cm` : '—'],
                  ['Seitenverhältnis', aspect ? `${aspect}:1` : '—'],
                  ['Pixeldichte', m.displayMode?.pixelDensity ? `${num(m.displayMode.pixelDensity, 0)} PPI` : '—'],
                  ['Fertigung', m.year ? `${m.year} / KW ${m.week ?? '—'}` : '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="eyebrow">{label}</div>
                    <div className="mt-1 font-mono text-[13.5px] text-fg">{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1.5 border-t border-line pt-3 font-mono text-[11px] text-faint">
                <div className="truncate" title={m.instance ?? ''}>Instanz: {m.instance ?? '—'}</div>
                <div className="truncate" title={m.serial ?? ''}>Seriennummer: {m.serial ?? '—'}</div>
                <div>Herstellercode: {m.productCode ?? '—'}</div>
              </div>
            </div>
          )
        })}
      </div>

      <Panel code="MODE" title="Anzeigemodi des Systems">
        {modes.length === 0 ? (
          <EmptyState title="Keine Anzeigemodi auslesbar">
            Windows blockiert den Zugriff auf die Auflösungseinstellungen (etwa bei eingeschränkter Skriptsprache). Die
            EDID-Daten oben bleiben davon unberührt.
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <StatTile
                label="Höchster Modus"
                value={bestMode ? `${num(bestMode.width ?? 0)} × ${num(bestMode.height ?? 0)}` : '—'}
                hint={bestMode?.device ?? undefined}
              />
              <StatTile label="Bildwiederholrate" value={bestMode?.refreshHz ? num(bestMode.refreshHz) : '—'} unit="Hz" hint="höchster Modus" />
              <StatTile label="Farbtiefe" value={bestMode?.bitsPerPixel ? num(bestMode.bitsPerPixel) : '—'} unit="Bit" />
              <StatTile label="Modi gesamt" value={num(modes.length)} hint="auflösbare Kombinationen" />
            </div>
            <div className="mt-5">
              <DataTable
                headers={['Auflösung', 'Bildrate', 'Farbtiefe', 'Gerät']}
                rows={modes
                  .slice()
                  .sort((a, b) => (b.width ?? 0) - (a.width ?? 0) || (b.refreshHz ?? 0) - (a.refreshHz ?? 0))
                  .slice(0, 24)
                  .map((mode) => [
                    `${num(mode.width ?? 0)} × ${num(mode.height ?? 0)}`,
                    mode.refreshHz ? `${num(mode.refreshHz)} Hz` : '—',
                    mode.bitsPerPixel ? `${num(mode.bitsPerPixel)} Bit` : '—',
                    mode.device ?? '—',
                  ])}
              />
              <p className="mt-3 font-mono text-[10.5px] text-faint">
                Die 24 höchsten Einträge von {num(modes.length)} · Windows meldet Bildrate und Farbtiefe nur für Modi, die es
                tatsächlich als aktives Format kennt
              </p>
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">
              Windows meldet die Modi zentral für alle Ausgänge und verteilt sie nicht auf einzelne Bildschirme. Deshalb steht
              oben der höchste Modus des Systems, nicht der eines bestimmten Panels.
            </p>
          </>
        )}
      </Panel>

      <Panel code="EDD" title="EDID-Rohdaten">
        <DataTable
          headers={['Hersteller', 'Produktcode', 'Name', 'Seriennummer', 'Woche', 'Jahr', 'Diagonale', 'Eingang', 'Anschluss']}
          rows={monitors.map((m) => [
            m.manufacturer ?? '—',
            m.productCode ?? '—',
            m.name ?? '—',
            m.serial ?? '—',
            m.week === null || m.week === undefined ? '—' : String(m.week),
            m.year === null || m.year === undefined ? '—' : String(m.year),
            m.diagonalIn ? `${m.diagonalIn}"` : '—',
            m.videoInput === null || m.videoInput === undefined ? '—' : String(m.videoInput),
            monitorOutputLabel(m.outputTech) ?? String(m.outputTech ?? '—'),
          ])}
          empty="Keine EDID-Daten."
        />
        <div className="mt-5 border-t border-line pt-4">
          <KV
            items={[
              { label: 'Übertragungscharakteristik', value: snapshot?.sections.monitors.data?.monitors?.[0]?.transferChar ? `${snapshot.sections.monitors.data.monitors[0].transferChar} MHz` : '—' },
              { label: 'Quelle', value: 'WmiMonitorID / WmiMonitorConnectionParams' },
            ]}
          />
        </div>
      </Panel>
    </div>
  )
}
