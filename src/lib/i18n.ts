import { useSyncExternalStore } from 'react'

export type Locale = 'de' | 'en'

/**
 * Grundtexte der Oberfläche. Weitere Bausteine (labels.ts, Seiten) melden ihre
 * eigenen Schlüssel über registriere() an, damit sie getrennt pflegbar bleiben.
 */
const GRUND: Record<Locale, Record<string, string>> = {
  de: {},
  en: {
    'nav.overview': 'Overview',
    'nav.memory': 'Memory',
    'nav.storage': 'Storage',
    'nav.cpu': 'Processor',
    'nav.gpu': 'Graphics',
    'nav.bench': 'Performance',
    'nav.board': 'Mainboard & BIOS',
    'nav.monitors': 'Displays',
    'nav.network': 'Network',
    'nav.devices': 'Devices',
    'nav.battery': 'Battery',
    'nav.sensors': 'Sensors',
    'nav.export': 'System & Export',
    'top.section': 'Section',
    'top.refresh': 'Refresh',
    'top.running': 'Running…',
    'top.stand': 'As of',
    'top.read': '{code} read',
    'top.pending': '{code} pending',
    'app.footer.sources': 'data from WMI/CIM, EDID and nvidia-smi',
    'app.footer.live': 'Live measurement',
    'app.footer.search': 'Search (Ctrl+F)',
    'app.search.hint': 'Type at least two characters. Every value of the current capture is searched, including fields that are not visible right now.',
    'app.search.open': 'open',
    'app.search.copy': 'Ctrl+C copies the value',
    'app.search.close': 'Esc closes',
    'app.search.nothing': 'Nothing found.',
    'app.search.placeholder': 'Search value, model or serial number …',
    'app.search.results': '{count} of {total}',
    'app.shortcuts': 'Ctrl+1…9 jumps to a section, Ctrl+F searches',
  },
}

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'English' },
]

type Platzhalter = Record<string, string | number>

/** Übersetzungen je Sprache. Fehlt ein Schlüssel, greift der deutsche Text. */
const woerter: Record<Locale, Record<string, string>> = {
  de: { ...GRUND.de },
  en: { ...GRUND.en },
}

const listeners = new Set<() => void>()
let aktuelleSprache: Locale = 'de'

function persist(locale: Locale): void {
  try {
    localStorage.setItem('inspekt:locale', locale)
  } catch {
    /* localStorage kann im Electron-Kontext fehlen - dann bleibt es bei de */
  }
}

/** Sprache auf das HTML-Dokument spiegeln, sofern es eines gibt (Electron/Test). */
function spiegeln(locale: Locale): void {
  const doc = (globalThis as { document?: { documentElement?: { lang?: string } } }).document
  if (doc?.documentElement) doc.documentElement.lang = locale
}

/** Beim Start einmal aufrufen: liest die zuletzt gewählte Sprache. */
export function initLocale(): void {
  try {
    const gespeichert = localStorage.getItem('inspekt:locale')
    if (gespeichert === 'de' || gespeichert === 'en') aktuelleSprache = gespeichert
  } catch {
    /* localStorage kann im Electron-Kontext fehlen - dann bleibt es bei de */
  }
  spiegeln(aktuelleSprache)
  listeners.forEach((listener) => listener())
}

export function setLocale(locale: Locale): void {
  if (locale === aktuelleSprache) return
  aktuelleSprache = locale
  persist(locale)
  spiegeln(locale)
  listeners.forEach((listener) => listener())
}

export function getLocale(): Locale {
  return aktuelleSprache
}

function ersetzen(text: string, vars?: Platzhalter): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (treffer, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : treffer,
  )
}

/**
 * Übersetzt einen Schlüssel. `fallback` ist der deutsche Text und dient
 * gleichzeitig als Vorgabe, falls eine Sprache noch keine Übersetzung hat –
 * so bleibt jede Stelle auch ohne vollständige Übersetzung lesbar.
 */
export function t(key: string, fallback?: string, vars?: Platzhalter): string {
  const text = woerter[aktuelleSprache][key] ?? woerter.de[key] ?? fallback ?? key
  return ersetzen(text, vars)
}

/** Für Dateien, die ihre Texte anmelden (labels.ts, Seiten). */
export function registriere(dictionary: Partial<Record<Locale, Record<string, string>>>): void {
  for (const [sprache, eintraege] of Object.entries(dictionary)) {
    const ziel = woerter[sprache as Locale]
    if (!ziel) continue
    Object.assign(ziel, eintraege)
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void; t: typeof t } {
  const locale = useSyncExternalStore(
    subscribe,
    () => aktuelleSprache,
    () => 'de' as Locale,
  )
  return { locale, setLocale, t }
}

/** Anzahl übersetzter Schlüssel je Sprache – für Tests und Transparenz. */
export function translateStats(): Record<Locale, number> {
  return { de: Object.keys(woerter.de).length, en: Object.keys(woerter.en).length }
}

/** Prüft, ob ein Schlüssel für eine Sprache hinterlegt ist (ohne Textvergleich). */
export function uebersetzt(key: string, locale: Locale): boolean {
  return typeof woerter[locale][key] === 'string'
}