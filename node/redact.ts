import type { Snapshot } from '../shared/schema.ts'

/**
 * Anonymisierung für Snapshots, die ins Repository oder in einen Bugreport
 * wandern. Ersetzt identifiers (Seriennummern, UUIDs, Hostname, MAC, IPs),
 * lässt aber Baureihen, Modellnamen und Zählwerte unangetastet – die
 * Smoke-Tests brauchen diese, um sinnvoll zu prüfen.
 */
const REDACTED = 'REDACTED'

const SENSITIVE_KEY = /(serial|uuid|guid|uniqueid|hostname|username|owner|asset|instance|identifying|permanentmac|^mac$)/i

const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,}[0-9a-f]{1,4}\b/i
const MAC = /\b[0-9a-f]{2}(?:[:-][0-9a-f]{2}){5}\b/i
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

export interface RedactResult {
  snapshot: Snapshot
  /** Anzahl ersetzter Werte */
  count: number
  /** Feldpfade, die angefasst wurden (für Kontrollausgaben) */
  fields: string[]
}

export function redactSnapshot(input: Snapshot): RedactResult {
  let count = 0
  const fields = new Set<string>()

  const redactString = (value: string, where: string): string => {
    // UUIDs stehen mitten in PNP-IDs und werden nur teilweise ersetzt,
    // damit die Geräteklasse im anonymisierten Snapshot lesbar bleibt.
    if (UUID.test(value)) {
      UUID.lastIndex = 0
      count++
      fields.add(where)
      return value.replace(UUID, 'REDACTED-GUID')
    }
    UUID.lastIndex = 0
    if (IPV4.test(value) || IPV6.test(value) || MAC.test(value)) {
      count++
      fields.add(where)
      return REDACTED
    }
    return value
  }

  const visit = (node: unknown, where: string): unknown => {
    if (typeof node === 'string') return redactString(node, where)
    if (Array.isArray(node)) return node.map((v, i) => visit(v, `${where}[${i}]`))
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(node)) {
        const path = `${where}.${key}`
        if (SENSITIVE_KEY.test(key) && (typeof value === 'string' || typeof value === 'number')) {
          count++
          fields.add(path)
          out[key] = REDACTED
          continue
        }
        out[key] = visit(value, path)
      }
      return out
    }
    return node
  }

  const walked = visit(JSON.parse(JSON.stringify(input)) as Snapshot, '$') as Snapshot
  walked.collectedAt = new Date(0).toISOString()

  return { snapshot: walked, count, fields: [...fields].sort() }
}

/** Prüft, ob ein Text noch identifizierende Muster enthält. */
export function findIdentifiers(input: Snapshot): string[] {
  const found = new Set<string>()
  const walk = (node: unknown, where: string): void => {
    if (typeof node === 'string') {
      const leaf = where.split('.').pop() ?? ''
      const uuidHit = UUID.test(node)
      UUID.lastIndex = 0
      if (IPV4.test(node) || MAC.test(node) || uuidHit || SENSITIVE_KEY.test(leaf.replace(/\[\d+\]$/, ''))) {
        if (node !== REDACTED) found.add(`${where} = ${node}`)
      }
      return
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${where}[${i}]`))
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) walk(value, `${where}.${key}`)
    }
  }
  walk(input, '$')
  return [...found]
}