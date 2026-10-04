/**
 * Ringpuffer für Protokolleinträge. Inspekt schreibt nichts nach außen –
 * diese Liste ist der einzige Ort, an dem Fehler und Hinweise sichtbar werden,
 * und genau der Inhalt des Diagnoseblocks für Fehlerberichte.
 */
export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  at: number
  level: LogLevel
  quelle: string
  text: string
}

const LIMIT = 500
const eintraege: LogEntry[] = []

export function log(level: LogLevel, quelle: string, text: string): void {
  eintraege.push({ at: Date.now(), level, quelle, text: text.replace(/\s+/g, ' ').slice(0, 400) })
  if (eintraege.length > LIMIT) eintraege.splice(0, eintraege.length - LIMIT)
}

export const logInfo = (quelle: string, text: string): void => log('info', quelle, text)
export const logWarn = (quelle: string, text: string): void => log('warn', quelle, text)
export const logError = (quelle: string, text: string): void => log('error', quelle, text)

/** Neueste Einträge zuerst. */
export function logEntries(limit = 200): LogEntry[] {
  return eintraege.slice(-limit).reverse()
}

export function logStats(): { gesamt: number; warnungen: number; fehler: number } {
  return {
    gesamt: eintraege.length,
    warnungen: eintraege.filter((e) => e.level === 'warn').length,
    fehler: eintraege.filter((e) => e.level === 'error').length,
  }
}

export function logText(limit = 40): string {
  const zeilen = logEntries(limit).map(
    (e) => `${new Date(e.at).toISOString()} [${e.level.toUpperCase()}] ${e.quelle}: ${e.text}`,
  )
  return zeilen.join('\n') || '(keine Einträge)'
}