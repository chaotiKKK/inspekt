import type { Snapshot } from './schema.ts'

export type ChangeArt = 'hinzugefügt' | 'entfernt' | 'geändert'

export interface Change {
  /** Bereich, z. B. „Speicher" */
  bereich: string
  /** Feld oder Objekt, z. B. „DIMM_2 Kapazität" */
  feld: string
  vorher: string | null
  nachher: string | null
  art: ChangeArt
  /** Momentanwert, ändert sich bei jedem Ablesen */
  flüchtig: boolean
}

export interface SnapshotDiff {
  erstellt: number
  verglichen: { vorher: number; nachher: number }
  zusammenfassung: { hinzugefügt: number; entfernt: number; geändert: number; unverändert: number }
  aenderungen: Change[]
}

type Wert = string | number | boolean | null | undefined

function text(v: Wert): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'boolean') return v ? 'ja' : 'nein'
  if (typeof v === 'number') return new Intl.NumberFormat('de-DE').format(v)
  return v
}

interface Probe {
  bereich: string
  feld: string
  holen: (s: Snapshot) => Wert
  flüchtig?: boolean
}

/** Einzelwerte, die sich sinnvoll vergleichen lassen. */
const PROBES: Probe[] = [
  { bereich: 'System', feld: 'Hersteller', holen: (s) => s.sections.system.data?.manufacturer },
  { bereich: 'System', feld: 'Modell', holen: (s) => s.sections.system.data?.model },
  { bereich: 'System', feld: 'BIOS-Version', holen: (s) => s.sections.system.data?.biosVersion },
  { bereich: 'System', feld: 'BIOS-Datum', holen: (s) => s.sections.system.data?.biosDate },
  { bereich: 'System', feld: 'Mainboard', holen: (s) => s.sections.system.data?.boardProduct },
  { bereich: 'System', feld: 'Windows-Build', holen: (s) => s.sections.system.data?.osBuild },
  { bereich: 'System', feld: 'Arbeitsspeicher gesamt', holen: (s) => s.sections.system.data?.totalMemory },
  { bereich: 'System', feld: 'Letzter Start', holen: (s) => s.sections.system.data?.lastBoot, flüchtig: true },

  { bereich: 'Prozessor', feld: 'Modell', holen: (s) => s.sections.cpu.data?.name },
  { bereich: 'Prozessor', feld: 'Kerne', holen: (s) => s.sections.cpu.data?.cores },
  { bereich: 'Prozessor', feld: 'Threads', holen: (s) => s.sections.cpu.data?.threads },
  { bereich: 'Prozessor', feld: 'Max. Takt', holen: (s) => s.sections.cpu.data?.items?.[0]?.maxClockMHz },
  { bereich: 'Prozessor', feld: 'L3-Cache', holen: (s) => s.sections.cpu.data?.items?.[0]?.l3CacheKB },

  { bereich: 'Arbeitsspeicher', feld: 'Slots gesamt', holen: (s) => s.sections.memory.data?.slotsTotal },
  { bereich: 'Arbeitsspeicher', feld: 'Slots belegt', holen: (s) => s.sections.memory.data?.slotsUsed },
  { bereich: 'Arbeitsspeicher', feld: 'Für Windows sichtbar', holen: (s) => s.sections.memory.data?.totalVisibleKB },
  { bereich: 'Arbeitsspeicher', feld: 'Maximal belegbar', holen: (s) => s.sections.memory.data?.maxCapacityKB },
  { bereich: 'Arbeitsspeicher', feld: 'Fehlerkorrektur', holen: (s) => s.sections.memory.data?.errorCorrection },
  { bereich: 'Arbeitsspeicher', feld: 'RAM belegt', holen: (s) => memUsed(s), flüchtig: true },

  { bereich: 'Speicher', feld: 'Datenträger gesamt', holen: (s) => s.sections.storage.data?.disks?.length },
  { bereich: 'Speicher', feld: 'Gesamtkapazität', holen: (s) => sumDisks(s) },
  { bereich: 'Speicher', feld: 'Freier Platz', holen: (s) => sumFree(s), flüchtig: true },

  { bereich: 'Grafik', feld: 'Adapter', holen: (s) => s.sections.gpu.data?.adapters?.length },
  { bereich: 'Grafik', feld: 'NVIDIA-Treiber', holen: (s) => s.sections.gpu.data?.nvidia?.driverVersion },

  { bereich: 'Monitore', feld: 'Anzahl', holen: (s) => s.sections.monitors.data?.monitors?.length },

  { bereich: 'Netzwerk', feld: 'Adapter', holen: (s) => s.sections.network.data?.adapters?.length },
  { bereich: 'Netzwerk', feld: 'Aktive Verbindungen', holen: (s) => s.sections.network.data?.adapters?.filter((a) => a.status === 'Up').length, flüchtig: true },

  { bereich: 'Geräte', feld: 'Gesamt', holen: (s) => s.sections.devices.data?.count },
  { bereich: 'Geräte', feld: 'Mit Fehlern', holen: (s) => s.sections.devices.data?.items?.filter((i) => (i.problem ?? 0) > 0).length },

  { bereich: 'Akku', feld: 'Ladezyklen', holen: (s) => s.sections.battery.data?.cycleCount },
  { bereich: 'Akku', feld: 'Ist-Kapazität', holen: (s) => s.sections.battery.data?.batteries?.[0]?.fullCapacity },
  { bereich: 'Akku', feld: 'Ladung', holen: (s) => s.sections.battery.data?.batteries?.[0]?.chargePercent, flüchtig: true },

  { bereich: 'Sicherheit', feld: 'Secure Boot', holen: (s) => s.sections.security.data?.secureBoot },
  { bereich: 'Sicherheit', feld: 'TPM vorhanden', holen: (s) => s.sections.security.data?.tpm?.present },

  { bereich: 'Sensoren', feld: 'CPU-Auslastung', holen: (s) => s.sections.sensors.data?.cpuLoadPercent, flüchtig: true },
  { bereich: 'Sensoren', feld: 'Laufzeit', holen: (s) => s.sections.system.data?.uptimeSec, flüchtig: true },
]

function memUsed(s: Snapshot): number | null {
  const mem = s.sections.memory.data
  if (!mem?.totalVisibleKB || mem.freePhysicalKB === null || mem.freePhysicalKB === undefined) return null
  return mem.totalVisibleKB - mem.freePhysicalKB
}

function sumDisks(s: Snapshot): number {
  return (s.sections.storage.data?.disks ?? []).reduce((sum, d) => sum + (d.size ?? 0), 0)
}

function sumFree(s: Snapshot): number {
  return (s.sections.storage.data?.logical ?? []).reduce((sum, l) => sum + (l.free ?? 0), 0)
}

/** Vergleicht Sammlungen über einen Schlüssel und meldet Zugänge und Abgänge. */
function vergleicheListe<T>(
  bereich: string,
  vorher: T[],
  nachher: T[],
  schluessel: (item: T) => string,
  felder: Array<[string, (item: T) => Wert]>,
  aenderungen: Change[],
): void {
  const mapVorher = new Map(vorher.map((item) => [schluessel(item), item]))
  const mapNachher = new Map(nachher.map((item) => [schluessel(item), item]))

  const beschreibung = (item: T): string =>
    felder.map(([name, holen]) => `${name}: ${text(holen(item)) ?? '—'}`).join(' · ')

  for (const [key, item] of mapNachher) {
    if (!mapVorher.has(key)) {
      aenderungen.push({ bereich, feld: key, vorher: null, nachher: beschreibung(item), art: 'hinzugefügt', flüchtig: false })
    }
  }
  for (const [key, alt] of mapVorher) {
    if (!mapNachher.has(key)) {
      aenderungen.push({ bereich, feld: key, vorher: beschreibung(alt), nachher: null, art: 'entfernt', flüchtig: false })
    }
  }
  for (const [key, item] of mapNachher) {
    const alt = mapVorher.get(key)
    if (!alt) continue
    for (const [name, holen] of felder) {
      const a = text(holen(alt))
      const b = text(holen(item))
      if (a === b) continue
      aenderungen.push({ bereich, feld: `${key} · ${name}`, vorher: a, nachher: b, art: 'geändert', flüchtig: false })
    }
  }
}

/**
 * Vergleicht zwei Erfassungen desselben Rechners. Gedacht für die Frage
 * „was hat sich seit dem letzten Mal geändert?" – also Bauparts, nicht
 * Prozesszustände. Flüchtige Felder sind in der Ausgabe getrennt.
 */
export function diffSnapshots(vorher: Snapshot, nachher: Snapshot): SnapshotDiff {
  const aenderungen: Change[] = []

  for (const probe of PROBES) {
    const a = text(probe.holen(vorher))
    const b = text(probe.holen(nachher))
    if (a === b) continue
    aenderungen.push({
      bereich: probe.bereich,
      feld: probe.feld,
      vorher: a,
      nachher: b,
      art: a === null ? 'hinzugefügt' : b === null ? 'entfernt' : 'geändert',
      flüchtig: probe.flüchtig === true,
    })
  }

  vergleicheListe(
    'Arbeitsspeicher',
    vorher.sections.memory.data?.modules ?? [],
    nachher.sections.memory.data?.modules ?? [],
    (m) => `DIMM: ${m.locator ?? m.bank ?? '?'}`,
    [
      ['Kapazität', (m) => m.capacity],
      ['Takt', (m) => m.speed],
      ['Typ', (m) => m.memoryType ?? m.smbiosType],
      ['Hersteller', (m) => m.manufacturer],
    ],
    aenderungen,
  )

  vergleicheListe(
    'Speicher',
    vorher.sections.storage.data?.disks ?? [],
    nachher.sections.storage.data?.disks ?? [],
    (d) => `Laufwerk ${d.number}: ${d.model ?? 'unbekannt'}`,
    [
      ['Größe', (d) => d.size],
      ['Zustand', (d) => d.health],
      ['Firmware', (d) => d.firmwareRevision ?? d.firmware],
      ['PCIe', (d) => d.pcie?.text ?? null],
    ],
    aenderungen,
  )

  vergleicheListe(
    'Grafik',
    vorher.sections.gpu.data?.adapters ?? [],
    nachher.sections.gpu.data?.adapters ?? [],
    (a) => `Adapter: ${a.name ?? 'unbekannt'}`,
    [
      ['Grafikspeicher', (a) => a.adapterRam],
      ['Treiber', (a) => a.driver],
      ['Auflösung', (a) => (a.resolutionH && a.resolutionV ? `${a.resolutionH}×${a.resolutionV}` : null)],
    ],
    aenderungen,
  )

  vergleicheListe(
    'Monitore',
    vorher.sections.monitors.data?.monitors ?? [],
    nachher.sections.monitors.data?.monitors ?? [],
    (m) => `Monitor: ${m.manufacturer ?? '?'} ${m.productCode ?? ''}`.trim(),
    [
      ['Seriennummer', (m) => m.serial],
      ['Diagonale', (m) => m.diagonalIn],
      ['aktiv', (m) => m.active],
    ],
    aenderungen,
  )

  vergleicheListe(
    'Netzwerk',
    vorher.sections.network.data?.adapters ?? [],
    nachher.sections.network.data?.adapters ?? [],
    (a) => `Adapter: ${a.name ?? 'unbekannt'}`,
    [
      ['Status', (a) => a.status],
      ['MAC', (a) => a.mac],
      ['Link', (a) => a.linkSpeed],
    ],
    aenderungen,
  )

  vergleicheListe(
    'Geräte',
    vorher.sections.devices.data?.items ?? [],
    nachher.sections.devices.data?.items ?? [],
    (d) => `Gerät: ${d.name ?? 'unbekannt'}`,
    [
      ['Dienst', (d) => d.service],
      ['Status', (d) => d.status],
      ['Klasse', (d) => d.class],
    ],
    aenderungen,
  )

  const echte = aenderungen.filter((c) => !c.flüchtig)
  return {
    erstellt: Date.now(),
    verglichen: {
      vorher: Date.parse(vorher.collectedAt) || 0,
      nachher: Date.parse(nachher.collectedAt) || 0,
    },
    zusammenfassung: {
      hinzugefügt: echte.filter((c) => c.art === 'hinzugefügt').length,
      entfernt: echte.filter((c) => c.art === 'entfernt').length,
      geändert: echte.filter((c) => c.art === 'geändert').length,
      unverändert: PROBES.length - aenderungen.filter((c) => !c.flüchtig).length,
    },
    aenderungen: aenderungen.sort((a, b) => {
      if (a.flüchtig !== b.flüchtig) return a.flüchtig ? 1 : -1
      return a.bereich.localeCompare(b.bereich) || a.feld.localeCompare(b.feld)
    }),
  }
}