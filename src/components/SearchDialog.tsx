import { useEffect, useRef } from 'react'
import { CornerDownLeft, Copy, Search, X } from 'lucide-react'
import { alsText, type SucheApi } from '../lib/search.ts'

/** Overlay für die globale Suche (Strg+F), Trefferliste mit Sprungziel. */
export function SearchDialog({ suche, onKopieren }: { suche: SucheApi; onKopieren: (text: string) => void }): React.ReactNode | null {
  const eingabe = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (suche.offen) eingabe.current?.focus()
  }, [suche.offen])

  if (!suche.offen) return null
  const { ergebnis, aktiv, treffer } = ergebnis0(suche)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) suche.schliessen()
      }}
      role="dialog"
      aria-label="Globale Suche"
    >
      <div className="w-full max-w-[720px] overflow-hidden rounded-lg border border-line bg-panel shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search size={16} className="text-accent" aria-hidden="true" />
          <input
            ref={eingabe}
            value={suche.query}
            onChange={(e) => {
              suche.setQuery(e.target.value)
              suche.setAktiv(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                suche.weiter(1)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                suche.weiter(-1)
              } else if (e.key === 'Enter') {
                const hit = treffer[aktiv]
                if (hit) suche.trefferWaehlen(hit)
              }
            }}
            placeholder="Wert, Modell oder Seriennummer suchen …"
            className="flex-1 bg-transparent font-mono text-[14px] text-fg outline-none placeholder:text-faint"
            aria-label="Suchbegriff"
          />
          <span className="font-mono text-[11px] text-faint">
            {suche.query.length >= 2 ? `${treffer.length} von ${ergebnis.geprueft}` : ''}
          </span>
          <button type="button" className="btn" onClick={suche.schliessen} aria-label="Suche schließen">
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto">
          {suche.query.length < 2 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">
              Mindestens zwei Zeichen. Gesucht wird in allen Werten der aktuellen Erfassung – auch in Feldern, die gerade
              nicht auf dem Bildschirm stehen.
            </p>
          ) : treffer.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">Nichts gefunden.</p>
          ) : (
            <ul className="divide-y divide-line">
              {treffer.map((hit, i) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => suche.trefferWaehlen(hit)}
                    onMouseEnter={() => suche.setAktiv(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === aktiv ? 'bg-accent/12' : 'hover:bg-panel2'
                    }`}
                  >
                    <span className="w-28 shrink-0 font-mono text-[10.5px] tracking-[0.08em] text-accent uppercase">
                      {hit.bereich}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[11px] text-faint">{hit.schluessel}</span>
                      <span className="block truncate font-mono text-[12.5px] text-fg">{hit.value}</span>
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      title="Wert kopieren"
                      onClick={(e) => {
                        e.stopPropagation()
                        onKopieren(alsText(hit))
                      }}
                      className="shrink-0 rounded border border-line px-1.5 py-1 text-faint transition-colors hover:border-accent/50 hover:text-accent"
                    >
                      <Copy size={12} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-2 font-mono text-[10.5px] text-faint">
          <span className="flex items-center gap-1.5">
            <CornerDownLeft size={11} aria-hidden="true" /> öffnen
          </span>
          <span>↑ ↓ weiterspringen</span>
          <span>Strg+C Wert kopieren</span>
          <span>Esc schließen</span>
        </div>
      </div>
    </div>
  )
}

/** Kleiner Helfer, damit der Hook nicht doppelt gelesen werden muss. */
function ergebnis0(suche: SucheApi): { ergebnis: SucheApi['ergebnis']; treffer: SucheApi['ergebnis']['treffer']; aktiv: number } {
  return { ergebnis: suche.ergebnis, treffer: suche.ergebnis.treffer, aktiv: suche.aktiv }
}