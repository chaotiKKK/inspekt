import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NavId } from './nav.ts'

export interface SearchHit {
  id: string
  /** Quelle des Treffers */
  bereich: string
  /** technischer Schlüssel, für Sprungziele */
  schluessel: string
  label: string
  value: string
  nav: NavId
}

export interface SearchResult {
  query: string
  treffer: SearchHit[]
  /** Anzahl geprüfter Felder */
  geprueft: number
}

/**
 * Suchindex über den aktuellen Snapshot: jeder sinnvolle Wert wird zu einem
 * Treffer mit Sprungziel. Zweck ist die Frage "wo steht denn ...?" – die bei
 * dreizehn Bereichen sonst zeitaufwendig wird.
 */
function sammleWerte(value: unknown, bereich: string, nav: NavId, pfad: string, out: SearchHit[]): void {
  if (value === null || value === undefined || out.length > 12000) return
  if (Array.isArray(value)) {
    value.forEach((v, i) => sammleWerte(v, bereich, nav, `${pfad}[${i}]`, out))
    return
  }
  if (typeof value === 'object') {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      sammleWerte(v, bereich, nav, pfad ? `${pfad}.${key}` : key, out)
    }
    return
  }
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return
    out.push({ id: `${nav}-${pfad}`, bereich, schluessel: pfad, label: pfad.split('.').pop() ?? pfad, value: text, nav })
    return
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    out.push({ id: `${nav}-${pfad}`, bereich, schluessel: pfad, label: pfad.split('.').pop() ?? pfad, value: String(value), nav })
  }
}

const BEREICHE: { id: NavId; bereich: string; key: string }[] = [
  { id: 'overview', bereich: 'System', key: 'system' },
  { id: 'memory', bereich: 'Arbeitsspeicher', key: 'memory' },
  { id: 'storage', bereich: 'Speicher', key: 'storage' },
  { id: 'cpu', bereich: 'Prozessor', key: 'cpu' },
  { id: 'gpu', bereich: 'Grafik', key: 'gpu' },
  { id: 'board', bereich: 'Mainboard & BIOS', key: 'security' },
  { id: 'monitors', bereich: 'Monitore', key: 'monitors' },
  { id: 'network', bereich: 'Netzwerk', key: 'network' },
  { id: 'devices', bereich: 'Geräte', key: 'devices' },
  { id: 'battery', bereich: 'Akku', key: 'battery' },
  { id: 'sensors', bereich: 'Sensoren', key: 'sensors' },
]

export function baueIndex(snapshot: unknown): SearchHit[] {
  const out: SearchHit[] = []
  for (const entry of BEREICHE) {
    const sections = (snapshot as { sections?: Record<string, { data?: unknown }> } | null)?.sections
    const data = sections?.[entry.key]?.data
    if (data) sammleWerte(data, entry.bereich, entry.id, '', out)
  }
  return out
}

/** Kopierfertige Zeile: Feld, Wert, Herkunft. */
export function alsText(hit: SearchHit): string {
  return `${hit.bereich} · ${hit.schluessel}: ${hit.value}`
}

export interface SucheState {
  offen: boolean
  query: string
  ergebnis: SearchResult
  aktiv: number
}

export interface SucheApi extends SucheState {
  oeffnen: (vorgabe?: string) => void
  schliessen: () => void
  setQuery: (q: string) => void
  setAktiv: (i: number) => void
  weiter: (delta: number) => void
  trefferWaehlen: (hit: SearchHit) => void
}

function normalisieren(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function useSuche(index: SearchHit[], onJump: (hit: SearchHit) => void): SucheApi {
  const [offen, setOffen] = useState(false)
  const [query, setQuery] = useState('')
  const [aktiv, setAktiv] = useState(0)

  const ergebnis = useMemo<SearchResult>(() => {
    const q = normalisieren(query)
    if (q.length < 2) return { query, treffer: [], geprueft: index.length }
    const teile = q.split(' ').filter(Boolean)
    const treffer = index.filter((hit) => {
      const hay = normalisieren(`${hit.bereich} ${hit.schluessel} ${hit.label} ${hit.value}`)
      return teile.every((teil) => hay.includes(teil))
    })
    return { query, treffer: treffer.slice(0, 60), geprueft: index.length }
  }, [query, index])

  const weiter = useCallback((delta: number) => {
    const anzahl = ergebnis.treffer.length
    if (anzahl === 0) return
    setAktiv((prev) => (prev + delta + anzahl) % anzahl)
  }, [ergebnis.treffer.length])

  const trefferWaehlen = useCallback(
    (hit: SearchHit) => {
      setOffen(false)
      setQuery('')
      onJump(hit)
    },
    [onJump],
  )

  // Strg+F öffnet, Escape schließt – wie im Browser erwartet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const inFeld = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setOffen(true)
        setAktiv(0)
        return
      }
      if (e.key === 'Escape' && offen) {
        e.preventDefault()
        setOffen(false)
        setQuery('')
        return
      }
      if (!offen) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        weiter(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        weiter(-1)
      } else if (e.key === 'Enter') {
        const hit = ergebnis.treffer[aktiv]
        if (hit) {
          e.preventDefault()
          trefferWaehlen(hit)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setOffen(false)
      } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        const hit = ergebnis.treffer[aktiv]
        if (hit) {
          e.preventDefault()
          void navigator.clipboard?.writeText(alsText(hit))
        }
      } else if (inFeld) {
        // Eingabe landet ohnehin im Suchfeld
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [offen, aktiv, ergebnis.treffer, weiter, trefferWaehlen])

  return {
    offen,
    query,
    ergebnis,
    aktiv,
    oeffnen: (vorgabe?: string) => {
      setOffen(true)
      setAktiv(0)
      if (vorgabe !== undefined) setQuery(vorgabe)
    },
    schliessen: () => {
      setOffen(false)
      setQuery('')
    },
    setQuery,
    setAktiv,
    weiter,
    trefferWaehlen,
  }
}

/** Kopiert einen Wert in die Zwischenablage und meldet das Ergebnis zurück. */
export async function kopieren(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}