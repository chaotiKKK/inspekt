import { useCallback, useEffect, useState } from 'react'
import { GitCompare, Save, Trash2 } from 'lucide-react'
import { Badge, DataTable, EmptyState, Notice, Panel, StatTile } from './ui.tsx'
import { dateTime, num } from '../lib/format.ts'
import type { SnapshotDiff } from '../../shared/diff.ts'
import type { SnapshotEntry } from '../../shared/api.ts'

interface Props {
  /** true, solange eine Erfassung vorliegt */
  hasSnapshot: boolean
}

type Meldung = { art: 'good' | 'warn' | 'bad'; text: string } | null

const ART_TEXT: Record<string, string> = {
  hinzugefügt: 'hinzugefügt',
  entfernt: 'entfernt',
  geändert: 'geändert',
}

/**
 * Vergleich des aktuellen Zustands mit einer gespeicherten Referenz.
 * Die Referenz ist eine vollständige Erfassung, die im Benutzerprofil liegt –
 * damit lässt sich später beantworten, was seit dem letzten Besuch dazugekommen ist.
 */
export function SnapshotCompare({ hasSnapshot }: Props): React.ReactNode {
  const [entries, setEntries] = useState<SnapshotEntry[]>([])
  const [diff, setDiff] = useState<SnapshotDiff | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState<'save' | 'diff' | 'delete' | null>(null)
  const [meldung, setMeldung] = useState<Meldung>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await window.inspekt.snapshotList()
      setEntries(list)
      setSelected((prev) => prev ?? list[0]?.id ?? null)
    } catch {
      setEntries([])
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function save(): Promise<void> {
    if (busy) return
    setBusy('save')
    setMeldung(null)
    try {
      const entry = await window.inspekt.snapshotSave(label)
      setLabel('')
      setDiff(null)
      setSelected(entry.id)
      await refresh()
      setMeldung({ art: 'good', text: `Referenz „${entry.label}" gespeichert (${dateTime(entry.collectedAt)}).` })
    } catch (err) {
      setMeldung({ art: 'bad', text: err instanceof Error ? err.message : 'Speichern fehlgeschlagen.' })
    } finally {
      setBusy(null)
    }
  }

  async function compare(): Promise<void> {
    if (!selected || busy) return
    setBusy('diff')
    setMeldung(null)
    try {
      setDiff(await window.inspekt.snapshotDiff(selected))
    } catch (err) {
      setMeldung({ art: 'bad', text: err instanceof Error ? err.message : 'Vergleich fehlgeschlagen.' })
    } finally {
      setBusy(null)
    }
  }

  async function remove(id: string): Promise<void> {
    if (busy) return
    setBusy('delete')
    try {
      await window.inspekt.snapshotDelete(id)
      if (selected === id) {
        setSelected(null)
        setDiff(null)
      }
      await refresh()
      setMeldung({ art: 'good', text: 'Referenz gelöscht.' })
    } catch (err) {
      setMeldung({ art: 'bad', text: err instanceof Error ? err.message : 'Löschen fehlgeschlagen.' })
    } finally {
      setBusy(null)
    }
  }

  const echte = (diff?.aenderungen ?? []).filter((c) => !c.flüchtig)
  const fluechtig = (diff?.aenderungen ?? []).filter((c) => c.flüchtig)

  return (
    <Panel
      code="CMP"
      title="Vergleich mit einer früheren Erfassung"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Bezeichnung, z. B. vor dem RAM-Tausch"
            className="w-64 rounded border border-line2 bg-panel2 px-2.5 py-1.5 font-mono text-[12px] text-fg outline-none placeholder:text-faint"
            aria-label="Bezeichnung der Referenz"
          />
          <button type="button" className="btn flex items-center gap-2" onClick={() => void save()} disabled={!hasSnapshot || busy !== null} data-compare="save">
            <Save size={13} aria-hidden="true" />
            {busy === 'save' ? 'Wird erfasst …' : 'Aktuellen Stand merken'}
          </button>
        </div>
      }
    >
      {entries.length === 0 ? (
        <EmptyState title="Noch keine Referenz gespeichert">
          „Aktuellen Stand merken" legt eine vollständige Erfassung im Datenordner ab. Später genügt ein Klick auf
          „Vergleichen", um zu sehen, was sich geändert hat – neue Laufwerke, anderer Speicher, neues BIOS.
        </EmptyState>
      ) : (
        <>
          <DataTable
            headers={['Bezeichnung', 'Gespeichert', 'System', 'Bereiche', '']}
            rows={entries.map((entry) => [
              <span className={entry.id === selected ? 'text-accent' : 'text-fg'}>{entry.label}</span>,
              dateTime(entry.collectedAt),
              entry.system,
              entry.fehlerhaft.length === 0 ? <Badge tone="good">alle gelesen</Badge> : <Badge tone="warn">{entry.fehlerhaft.join(', ')}</Badge>,
              <span className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSelected(entry.id)
                    setDiff(null)
                  }}
                  disabled={busy !== null}
                >
                  {entry.id === selected ? 'ausgewählt' : 'wählen'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void remove(entry.id)}
                  disabled={busy !== null}
                  title="Referenz löschen"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </span>,
            ])}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button type="button" className="btn btn-primary flex items-center gap-2" onClick={() => void compare()} disabled={!selected || busy !== null} data-compare="run">
              <GitCompare size={14} aria-hidden="true" />
              {busy === 'diff' ? 'Erfassung läuft …' : 'Mit aktuellem Stand vergleichen'}
            </button>
            {selected && (
              <span className="font-mono text-[11px] text-faint">
                Referenz: {entries.find((e) => e.id === selected)?.label} · Vergleich startet eine frische Erfassung
              </span>
            )}
          </div>

          {meldung && (
            <div className="mt-4">
              <Notice tone={meldung.art === 'good' ? 'good' : meldung.art === 'warn' ? 'warn' : 'bad'} title={meldung.art === 'good' ? 'Erledigt' : meldung.art === 'warn' ? 'Hinweis' : 'Fehlgeschlagen'}>
                {meldung.text}
              </Notice>
            </div>
          )}

          {diff && (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <StatTile label="Hinzugefügt" value={num(diff.zusammenfassung.hinzugefügt)} tone={diff.zusammenfassung.hinzugefügt > 0 ? 'good' : 'default'} />
                <StatTile label="Entfernt" value={num(diff.zusammenfassung.entfernt)} tone={diff.zusammenfassung.entfernt > 0 ? 'warn' : 'default'} />
                <StatTile label="Geändert" value={num(diff.zusammenfassung.geändert)} tone={diff.zusammenfassung.geändert > 0 ? 'good' : 'default'} />
                <StatTile label="Unverändert" value={num(diff.zusammenfassung.unverändert)} />
              </div>

              {echte.length === 0 ? (
                <p className="rounded border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
                  Keine Änderung an der Hardware seit der Referenz.
                </p>
              ) : (
                <DataTable
                  headers={['Bereich', 'Feld', 'Vorher', 'Jetzt', 'Art']}
                  rows={echte.map((c) => [
                    c.bereich,
                    c.feld,
                    c.vorher ?? '—',
                    c.nachher ?? '—',
                    <Badge
                      key={`${c.bereich}-${c.feld}`}
                      tone={c.art === 'hinzugefügt' ? 'good' : c.art === 'entfernt' ? 'bad' : 'accent'}
                    >
                      {ART_TEXT[c.art] ?? c.art}
                    </Badge>,
                  ])}
                />
              )}

              {fluechtig.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
                    {fluechtig.length} Momentanwerte (Ladung, Auslastung, Laufzeit)
                  </summary>
                  <div className="mt-3">
                    <DataTable
                      headers={['Bereich', 'Feld', 'Vorher', 'Jetzt']}
                      rows={fluechtig.map((c) => [c.bereich, c.feld, c.vorher ?? '—', c.nachher ?? '—'])}
                    />
                  </div>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}