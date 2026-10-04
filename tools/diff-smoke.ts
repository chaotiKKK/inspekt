import { diffSnapshots } from '../shared/diff.ts'
import { SnapshotSchema, type Snapshot } from '../shared/schema.ts'

let failures = 0

function ok(label: string, condition: boolean, detail: string = ''): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    failures++
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

function dimm(locator: string, capacity: number, manufacturer: string) {
  return { locator, capacity, speed: 5600, memoryType: 34, manufacturer }
}

function sektionen(): Record<string, unknown> {
  return {
    system: {
      ok: true,
      ms: 10,
      data: {
        manufacturer: 'HP',
        model: 'OMEN 17',
        biosVersion: 'F10',
        biosDate: '2024-01-01',
        boardProduct: '88X',
        osBuild: '22631',
        totalMemory: 33554432,
        lastBoot: '2024-05-01T08:00:00Z',
        uptimeSec: 3600,
      },
    },
    cpu: {
      ok: true,
      ms: 8,
      data: { name: 'Ryzen AI 7 350', cores: 8, threads: 16, items: [{ maxClockMHz: 5100, l3CacheKB: 16384 }] },
    },
    memory: {
      ok: true,
      ms: 9,
      data: {
        slotsTotal: 2,
        slotsUsed: 2,
        totalVisibleKB: 31764352,
        freePhysicalKB: 14732032,
        maxCapacityKB: 33554432,
        errorCorrection: 3,
        modules: [dimm('DIMM 1', 17179869184, 'Hynix'), dimm('DIMM 2', 17179869184, 'Hynix')],
      },
    },
    storage: {
      ok: true,
      ms: 30,
      data: {
        disks: [{ number: 0, model: 'SN5000S', size: 1000000000000, health: 'Healthy', firmware: 'PSF', partitions: [] }],
        logical: [{ letter: 'C', size: 900000000000, free: 200000000000 }],
      },
    },
    gpu: {
      ok: true,
      ms: 20,
      data: {
        adapters: [{ name: 'RTX 5070', adapterRam: 8000000000, driver: '31.0.15.3202', resolutionH: 1920, resolutionV: 1080 }],
        nvidia: { index: 0, name: 'NVIDIA GeForce RTX 5070 Laptop GPU', driverVersion: '551.23' },
      },
    },
    monitors: {
      ok: true,
      ms: 12,
      data: { monitors: [{ manufacturer: 'Dell', productCode: 'MG248', serial: 'ABC123', diagonalIn: 24, active: true }] },
    },
    network: {
      ok: true,
      ms: 14,
      data: { adapters: [{ name: 'WLAN', status: 'Up', mac: 'AA:BB:CC:DD:EE:FF', linkSpeed: '866,7 Mbps' }] },
    },
    devices: {
      ok: true,
      ms: 25,
      data: {
        count: 2,
        items: [
          { name: 'Laufwerk 0', class: 'DiskDrive', service: 'disk', status: 'OK' },
          { name: 'Monitor', class: 'Monitor', service: 'monitor', status: 'OK' },
        ],
      },
    },
    battery: {
      ok: true,
      ms: 11,
      data: { present: true, cycleCount: 2, batteries: [{ chargePercent: 80, fullCapacity: 60000 }] },
    },
    security: {
      ok: true,
      ms: 10,
      data: { secureBoot: true, tpm: { present: false } },
    },
    sensors: { ok: true, ms: 10, data: { cpuLoadPercent: 10 } },
  }
}

/** Vollständiger Snapshot, wie der Collector ihn liefert. */
function basis(collectedAt: string): Snapshot {
  return SnapshotSchema.parse({
    schema: 'inspekt/1',
    version: 1,
    collectedAt,
    totalMs: 100,
    elevated: false,
    psVersion: '5.1',
    sections: sektionen(),
  })
}

type Raw = { collectedAt: string; sections: Record<string, { ok: boolean; ms?: number; error?: string; data?: Record<string, unknown> }> }

function klon(snapshot: Snapshot): Raw {
  return JSON.parse(JSON.stringify(snapshot)) as Raw
}

function parse(raw: Raw): Snapshot {
  return SnapshotSchema.parse(raw)
}

console.log('diff-smoke: Vergleich zweier Erfassungen\n')

const alt = basis('2024-05-01T08:00:00Z')
const neuRoh = klon(alt)
neuRoh.collectedAt = '2024-06-01T10:00:00Z'
;(neuRoh.sections.system.data as Record<string, unknown>).uptimeSec = 86400
;(neuRoh.sections.system.data as Record<string, unknown>).lastBoot = '2024-05-31T22:00:00Z'
;(neuRoh.sections.memory.data as Record<string, unknown>).freePhysicalKB = 8000000
;(neuRoh.sections.battery.data as { batteries: Array<Record<string, unknown>> }).batteries[0].chargePercent = 42
;(neuRoh.sections.sensors.data as Record<string, unknown>).cpuLoadPercent = 87
const neu = parse(neuRoh)

console.log('unveränderte Erfassung')
const gleich = diffSnapshots(alt, neu)
const echteGleich = gleich.aenderungen.filter((c) => !c.flüchtig)
ok('keine Änderungen an der Hardware', echteGleich.length === 0, `${gleich.aenderungen.length} Einträge gesamt`)
ok('zusammenfassung ist leer', gleich.zusammenfassung.hinzugefügt === 0 && gleich.zusammenfassung.entfernt === 0 && gleich.zusammenfassung.geändert === 0)
ok('flüchtige werte erkannt', gleich.aenderungen.filter((c) => c.flüchtig).length >= 4, gleich.aenderungen.filter((c) => c.flüchtig).map((c) => c.feld).join(', '))
ok('zeitstempel übernommen', gleich.verglichen.vorher !== 0 && gleich.verglichen.nachher !== 0)
ok('flüchtige zählen nicht in die zusammenfassung', gleich.zusammenfassung.geändert === 0 && gleich.aenderungen.length > 0)

console.log('\nRAM: gleicher Platz, anderes Modul')
const ramRoh = klon(alt)
const ramDaten = ramRoh.sections.memory.data as { slotsUsed: number; modules: unknown[] }
ramDaten.slotsUsed = 1
ramDaten.modules = [dimm('DIMM 1', 32768 * 1024 * 1024, 'Crucial')]
const dRam = diffSnapshots(alt, parse(ramRoh))
ok('belegte slots geändert', dRam.aenderungen.some((c) => c.feld === 'Slots belegt' && c.art === 'geändert'), `${dRam.zusammenfassung.geändert} Änderungen`)
ok('hersteller am platz geändert', dRam.aenderungen.some((c) => c.feld.includes('Hersteller') && c.nachher === 'Crucial'))
ok('kapazität am platz geändert', dRam.aenderungen.some((c) => c.feld.includes('Kapazität') && c.nachher !== null))
ok('entferntes modul aus alter konfiguration', dRam.aenderungen.some((c) => c.feld.includes('DIMM 2') && c.art === 'entfernt'), dRam.aenderungen.filter((c) => c.feld.includes('DIMM 2')).map((c) => `${c.art}`).join(','))

console.log('\nRAM: zweiter belegter Platz')
const ram2Roh = klon(alt)
;(ram2Roh.sections.memory.data as { modules: unknown[] }).modules.push(dimm('DIMM 3', 17179869184, 'Crucial'))
const dRam2 = diffSnapshots(alt, parse(ram2Roh))
ok('drittes modul hinzugefügt', dRam2.aenderungen.some((c) => c.art === 'hinzugefügt' && c.feld.includes('DIMM 3')), dRam2.aenderungen.filter((c) => c.art === 'hinzugefügt').map((c) => c.nachher ?? '').join(' | '))
ok('neues modul mit angaben', dRam2.aenderungen.some((c) => c.art === 'hinzugefügt' && (c.nachher ?? '').includes('Crucial')))

console.log('\nBIOS- und Plattenwechsel')
const mixedRoh = klon(alt)
;(mixedRoh.sections.system.data as Record<string, unknown>).biosVersion = 'F12'
;(mixedRoh.sections.system.data as Record<string, unknown>).model = 'OMEN 17 (2025)'
;(mixedRoh.sections.storage.data as { disks: unknown[] }).disks = [
  { number: 0, model: 'SN5000S', size: 1000000000000, health: 'Healthy', firmware: 'PSF', partitions: [] },
  { number: 1, model: 'SPEEDY X', size: 2000000000000, health: 'Warning', firmware: 'X1', partitions: [] },
]
const dMixed = diffSnapshots(alt, parse(mixedRoh))
ok('bios-version geändert', dMixed.aenderungen.some((c) => c.feld === 'BIOS-Version' && c.nachher === 'F12'))
ok('zweites laufwerk hinzugefügt', dMixed.aenderungen.some((c) => c.art === 'hinzugefügt' && c.feld.includes('SPEEDY X')))
ok('gesamtkapazität geändert', dMixed.aenderungen.some((c) => c.feld === 'Gesamtkapazität'))
ok('zustand am neuen laufwerk', dMixed.aenderungen.some((c) => c.feld.includes('SPEEDY') && (c.nachher ?? '').includes('Warning')), dMixed.aenderungen.filter((c) => c.feld.includes('SPEEDY')).map((c) => `${c.art}: ${c.nachher ?? ''}`).join(' | '))
ok(
  'echte änderungen vor flüchtigen',
  (() => {
    const flags = dMixed.aenderungen.map((c) => c.flüchtig)
    const ersterFluechtiger = flags.indexOf(true)
    return ersterFluechtiger === -1 || flags.lastIndexOf(false) < ersterFluechtiger
  })(),
)

console.log('\nabschnitt nicht lesbar')
const ohneAkku = klon(alt)
ohneAkku.sections.battery = { ok: false, ms: 1, error: 'kein Akku' }
const dOhne = diffSnapshots(alt, parse(ohneAkku))
ok(
  'fehlende werte als entfernt',
  dOhne.aenderungen.some((c) => c.art === 'entfernt' && c.bereich === 'Akku'),
  dOhne.aenderungen.filter((c) => c.bereich === 'Akku').map((c) => `${c.feld}:${c.art}`).join(', '),
)

console.log('\ngeänderter Zustand statt Gerätetausch')
const treiberRoh = klon(alt)
;(treiberRoh.sections.gpu.data as { adapters: Array<Record<string, unknown>> }).adapters[0].driver = '32.0.15.9999'
const dTreiber = diffSnapshots(alt, parse(treiberRoh))
ok('treiberänderung erkannt', dTreiber.aenderungen.some((c) => c.feld.includes('Treiber') && c.art === 'geändert'))
ok('keine geräte hinzugefügt', dTreiber.zusammenfassung.hinzugefügt === 0)

console.log(`\n${failures} failure(s)`)
process.exit(failures > 0 ? 1 : 0)