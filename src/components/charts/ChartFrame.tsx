import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Maximize2, X } from 'lucide-react'

const EVENT = 'inspekt:chart-fullscreen'

/** Öffnet ein Diagramm als Vollbild-Overlay; der Inhalt wird mit übergeben. */
export function showChartFullscreen(inhalt: ReactNode, titel: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<{ inhalt: ReactNode; titel: string }>(EVENT, { detail: { inhalt, titel } }))
}

/**
 * Rahmen um jedes Diagramm: kleiner Kopf mit Titel und Vollbild-Knopf.
 * Der Knopf hebt nur den Diagrammteil heraus, die Seite bleibt unangetastet.
 */
export function ChartFrame({
  titel,
  hinweis,
  children,
}: {
  titel: string
  hinweis?: string
  children: ReactNode
}): ReactNode {
  const [offen, setOffen] = useState(false)

  return (
    <div className="chart-frame">
      <div className="mb-2 flex items-center justify-between gap-3 no-print">
        <span className="eyebrow">{titel}</span>
        <div className="flex items-center gap-2">
          {hinweis && <span className="font-mono text-[10px] text-faint">{hinweis}</span>}
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!offen) {
                setOffen(true)
                showChartFullscreen(
                  <div className="w-[1400px] max-w-full">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono text-[14px] font-semibold text-accent">{titel}</span>
                      <span className="font-mono text-[11px] text-faint">Esc schließt · Inspekt</span>
                    </div>
                    {children}
                  </div>,
                  titel,
                )
              }
            }}
            title="Groß anzeigen"
          >
            <Maximize2 size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

/** Overlay für Vollbild-Diagramme; wird einmal in App eingehängt. */
export function ChartOverlay(): React.ReactNode {
  const [zustand, setZustand] = useState<{ inhalt: ReactNode; titel: string } | null>(null)

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<{ inhalt: ReactNode; titel: string }>).detail
      setZustand(detail ?? null)
    }
    window.addEventListener(EVENT, handler)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setZustand(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener(EVENT, handler)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!zustand) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-bg/95 p-6"
      onClick={() => setZustand(null)}
      role="dialog"
      aria-label={`Diagramm ${zustand.titel} in Vollbild`}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn absolute -top-1 right-0 z-10"
          onClick={() => setZustand(null)}
          aria-label="Vollbild schließen"
        >
          <X size={13} aria-hidden="true" />
        </button>
        {zustand.inhalt}
      </div>
    </div>
  )
}