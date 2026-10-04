/**
 * Historische Referenzrechner für die Seite „Rechenkraft".
 *
 * Einheit durchgehend GFLOPS (10^9 Rechenoperationen pro Sekunde).
 * `basis: 'angabe'` = veröffentlichter bzw. berechneter Spitzenwert der Hersteller,
 * `basis: 'schätzung'` = aus Taktrate/MIPS grob abgeleitet – die Diagramme
 * kennzeichnen diese Werte, damit aus Schätzungen keine Tatsachen werden.
 */
export type MachineKind =
  | 'Rechner'
  | 'Heimcomputer'
  | 'Konsole'
  | 'Handheld'
  | 'Supercomputer'
  | 'Grafikkarte'
  | 'SoC'

export type Basis = 'angabe' | 'schätzung'

/** Herkunft eines Referenzwerts – als Link in der Oberfläche. */
export interface ReferenceSource {
  label: string
  url: string
}

export interface ReferenceMachine {
  id: string
  name: string
  year: number
  kind: MachineKind
  gflops: number
  basis: Basis
  clockMHz?: number | null
  transistors?: number | null
  note?: string
  source?: ReferenceSource | null
}

export const REFERENCE_MACHINES: ReferenceMachine[] = [
  { id: 'z1', name: 'Zuse Z1', year: 1938, kind: 'Rechner', gflops: 1e-9, basis: 'schätzung', note: 'mechanisch, ~1 Rechenschritt/s' },
  { id: 'z3', name: 'Zuse Z3', year: 1941, kind: 'Rechner', gflops: 1e-9, basis: 'schätzung', note: 'erster programmgesteuerter funktionierender Rechner' },
  { id: 'eniac', name: 'ENIAC', year: 1945, kind: 'Rechner', gflops: 5e-6, basis: 'angabe', clockMHz: 0.1, transistors: 17464, note: '5.000 Additionen/s, 17.464 Röhren' },
  { id: 'baby', name: 'Manchester "Baby"', year: 1948, kind: 'Rechner', gflops: 1.2e-6, basis: 'schätzung', note: '~1.200 Befehle/s' },
  { id: 'ibm704', name: 'IBM 704', year: 1954, kind: 'Rechner', gflops: 4e-5, basis: 'schätzung', note: 'erster Rechner mit Fließkomma-Einheit' },
  { id: 'agc', name: 'Apollo Guidance Computer', year: 1966, kind: 'Rechner', gflops: 4.3e-5, basis: 'schätzung', clockMHz: 2.048, transistors: 41200, note: '2,048 MHz, ~0,043 MIPS – Mondlandung 1969' },
  { id: 'cray1', name: 'Cray-1', year: 1976, kind: 'Supercomputer', gflops: 0.16, basis: 'angabe', clockMHz: 80, transistors: 200000, note: '160 MFLOPS, 200.000 Transistoren' },
  { id: 'apple2', name: 'Apple II', year: 1977, kind: 'Heimcomputer', gflops: 3e-4, basis: 'schätzung', clockMHz: 1.023 },
  { id: 'atari2600', name: 'Atari 2600', year: 1977, kind: 'Konsole', gflops: 3e-4, basis: 'schätzung', clockMHz: 1.19 },
  { id: 'ibmpc', name: 'IBM PC 5150', year: 1981, kind: 'Rechner', gflops: 3.3e-4, basis: 'schätzung', clockMHz: 4.77, transistors: 29000 },
  { id: 'zxspectrum', name: 'ZX Spectrum', year: 1982, kind: 'Heimcomputer', gflops: 7e-4, basis: 'schätzung', clockMHz: 3.5 },
  { id: 'c64', name: 'Commodore 64', year: 1982, kind: 'Heimcomputer', gflops: 4e-4, basis: 'schätzung', clockMHz: 0.985, note: '6510, 64 KB RAM' },
  { id: 'nes', name: 'Nintendo NES', year: 1983, kind: 'Konsole', gflops: 3.4e-4, basis: 'schätzung', clockMHz: 1.79 },
  { id: 'mac128', name: 'Macintosh 128K', year: 1984, kind: 'Rechner', gflops: 6e-4, basis: 'schätzung', clockMHz: 7.83 },
  { id: 'i386', name: 'Intel 80386-16', year: 1985, kind: 'Rechner', gflops: 3e-3, basis: 'schätzung', clockMHz: 16, transistors: 275000 },
  { id: 'amiga500', name: 'Commodore Amiga 500', year: 1987, kind: 'Heimcomputer', gflops: 1e-3, basis: 'schätzung', clockMHz: 7.16 },
  { id: 'gameboy', name: 'Nintendo Game Boy', year: 1989, kind: 'Handheld', gflops: 8e-4, basis: 'schätzung', clockMHz: 4.19 },
  { id: 'i486', name: 'Intel 486DX2-66', year: 1993, kind: 'Rechner', gflops: 0.05, basis: 'schätzung', clockMHz: 66, transistors: 1200000 },
  { id: 'pentium66', name: 'Intel Pentium 66', year: 1993, kind: 'Rechner', gflops: 0.1, basis: 'schätzung', clockMHz: 66, transistors: 3100000, note: 'erste Pentium-Generation' },
  { id: 'ps1', name: 'Sony PlayStation', year: 1994, kind: 'Konsole', gflops: 0.03, basis: 'schätzung', clockMHz: 33.87, note: 'R3000, ~30 MIPS' },
  { id: 'n64', name: 'Nintendo 64', year: 1996, kind: 'Konsole', gflops: 0.125, basis: 'schätzung', clockMHz: 93.75 },
  { id: 'pentium2', name: 'Intel Pentium II 300', year: 1997, kind: 'Rechner', gflops: 1, basis: 'schätzung', clockMHz: 300, transistors: 7500000 },
  { id: 'p3', name: 'Intel Pentium III 1 GHz', year: 2000, kind: 'Rechner', gflops: 2, basis: 'schätzung', clockMHz: 1000, transistors: 28100000, note: 'SSE, Single Precision' },
  { id: 'ps2', name: 'Sony PlayStation 2', year: 2000, kind: 'Konsole', gflops: 6.2, basis: 'schätzung', clockMHz: 294 },
  { id: 'xbox360', name: 'Microsoft Xbox 360', year: 2005, kind: 'Konsole', gflops: 115, basis: 'schätzung', clockMHz: 3200 },
  { id: 'a7', name: 'Apple A7 (iPhone 5s)', year: 2013, kind: 'SoC', gflops: 76, basis: 'schätzung', clockMHz: 1300, note: '64-Bit-ARM, GPU-Schätzwert' },
  { id: 'ps4', name: 'Sony PlayStation 4', year: 2013, kind: 'Konsole', gflops: 1843, basis: 'angabe', clockMHz: 1600, note: '1,84 TFLOPS (AMD-Angabe)' },
  { id: 'i7', name: 'Intel Core i7-4770', year: 2013, kind: 'Rechner', gflops: 140, basis: 'schätzung', clockMHz: 3500, transistors: 1400000000 },
  { id: 'switch', name: 'Nintendo Switch', year: 2017, kind: 'Konsole', gflops: 393, basis: 'schätzung', clockMHz: 1020 },
  { id: 'm1', name: 'Apple M1', year: 2020, kind: 'SoC', gflops: 2600, basis: 'schätzung', clockMHz: 3200, note: 'GPU-Peak 2,6 TFLOPS' },
  { id: 'ps5', name: 'Sony PlayStation 5', year: 2020, kind: 'Konsole', gflops: 10280, basis: 'angabe', clockMHz: 3500, note: '10,28 TFLOPS (AMD-Angabe)' },
  { id: 'rtx4090', name: 'NVIDIA RTX 4090', year: 2022, kind: 'Grafikkarte', gflops: 82584, basis: 'angabe', note: '82,6 TFLOPS FP32' },
  { id: 'r9', name: 'AMD Ryzen 9 7950X', year: 2022, kind: 'Rechner', gflops: 1450, basis: 'schätzung', clockMHz: 5700, note: '16 Kerne, AVX2-FMA-Spitze' },
  { id: 'frontier', name: 'Frontier (TOP500)', year: 2022, kind: 'Supercomputer', gflops: 1.19e12, basis: 'angabe', note: '1,19 EFLOPS, schnellster Rechner 2022' },
  { id: 'i4004', name: 'Intel 4004', year: 1971, kind: 'Rechner', gflops: 1.2e-3, basis: 'schätzung', clockMHz: 0.74, transistors: 2300, note: '740 kHz, 4-Bit-ALU – erster Ein-Chip-Prozessor' },
  { id: 'cdc6600', name: 'CDC 6600', year: 1964, kind: 'Supercomputer', gflops: 3, basis: 'angabe', clockMHz: 1, transistors: 400000, note: '≈ 3 MFLOPS, zehn Rechenwerke parallel' },
  { id: 'vectrex', name: 'Vectrex', year: 1982, kind: 'Konsole', gflops: 0.05, basis: 'schätzung', clockMHz: 1.79, note: '6809-Prozessor, vektorbasierte Spielepraktiken' },
  { id: 'genesis', name: 'Sega Mega Drive', year: 1989, kind: 'Konsole', gflops: 0.4, basis: 'schätzung', clockMHz: 7.67, note: '68000 plus Z80-Soundchip' },
  { id: 'snes', name: 'Super Nintendo', year: 1990, kind: 'Konsole', gflops: 0.5, basis: 'schätzung', clockMHz: 3.58, note: 'Ricoh 5A22, gemeinsamer Bus für CPU und PPU' },
  { id: 'jaguar', name: 'Atari Jaguar', year: 1994, kind: 'Konsole', gflops: 0.1, basis: 'schätzung', clockMHz: 26, note: '68000 plus zwei "Tom" Signalprozessoren' },
  { id: 'dreamcast', name: 'Sega Dreamcast', year: 1998, kind: 'Konsole', gflops: 2, basis: 'schätzung', clockMHz: 200, note: 'SH-4 mit V5-Shader, DirectX-Beschleuniger' },
  { id: 'gamecube', name: 'Nintendo GameCube', year: 2001, kind: 'Konsole', gflops: 1.4, basis: 'schätzung', clockMHz: 486, note: 'IBM Gekko, 32-Bit-Gleitkomma' },
  { id: 'xbox', name: 'Microsoft Xbox (original)', year: 2001, kind: 'Konsole', gflops: 6.6, basis: 'schätzung', clockMHz: 1730, note: 'Pentium III 1,73 GHz, DirectX-Vertexshader' },
  { id: 'rpi4', name: 'Raspberry Pi 4 (8 GB)', year: 2019, kind: 'SoC', gflops: 2, basis: 'schätzung', clockMHz: 1500, note: '8× Cortex-A72, 32-Bit-NEON' },
  { id: 'rpi5', name: 'Raspberry Pi 5', year: 2023, kind: 'SoC', gflops: 4, basis: 'schätzung', clockMHz: 2400, note: '4× Cortex-A76, GPU nur für Bilddaten' },
  { id: 'seriesx', name: 'Xbox Series X', year: 2020, kind: 'Konsole', gflops: 10300, basis: 'angabe', clockMHz: 3700, note: '10,3 TFLOPS laut Microsoft' },
]

/** Quellen der Referenzwerte, getrennt von der Messreihe gepflegt. */
const SOURCES: Record<string, ReferenceSource> = {
  z1: { label: 'Wikipedia: Zuse Z1', url: 'https://de.wikipedia.org/wiki/Zuse_Z1' },
  z3: { label: 'Wikipedia: Zuse Z3', url: 'https://de.wikipedia.org/wiki/Zuse_Z3' },
  eniac: { label: 'Wikipedia: ENIAC', url: 'https://en.wikipedia.org/wiki/ENIAC' },
  baby: { label: 'Wikipedia: Manchester Baby', url: 'https://en.wikipedia.org/wiki/Manchester_Baby' },
  ibm704: { label: 'Wikipedia: IBM 704', url: 'https://en.wikipedia.org/wiki/IBM_704' },
  agc: { label: 'Wikipedia: Apollo Guidance Computer', url: 'https://en.wikipedia.org/wiki/Apollo_Guidance_Computer' },
  cray1: { label: 'Wikipedia: Cray-1', url: 'https://en.wikipedia.org/wiki/Cray-1' },
  apple2: { label: 'Wikipedia: Apple II', url: 'https://en.wikipedia.org/wiki/Apple_II' },
  atari2600: { label: 'Wikipedia: Atari 2600', url: 'https://en.wikipedia.org/wiki/Atari_2600' },
  ibmpc: { label: 'Wikipedia: IBM Personal Computer', url: 'https://en.wikipedia.org/wiki/IBM_Personal_Computer' },
  zxspectrum: { label: 'Wikipedia: ZX Spectrum', url: 'https://en.wikipedia.org/wiki/ZX_Spectrum' },
  c64: { label: 'Wikipedia: Commodore 64', url: 'https://en.wikipedia.org/wiki/Commodore_64' },
  nes: { label: 'Wikipedia: Nintendo Entertainment System', url: 'https://en.wikipedia.org/wiki/Nintendo_Entertainment_System' },
  mac128: { label: 'Wikipedia: Macintosh 128K', url: 'https://en.wikipedia.org/wiki/Macintosh_128K' },
  i386: { label: 'Wikipedia: Intel 80386', url: 'https://en.wikipedia.org/wiki/Intel_80386' },
  amiga500: { label: 'Wikipedia: Amiga 500', url: 'https://en.wikipedia.org/wiki/Amiga_500' },
  gameboy: { label: 'Wikipedia: Game Boy', url: 'https://en.wikipedia.org/wiki/Game_Boy' },
  i486: { label: 'Wikipedia: Intel 80486', url: 'https://en.wikipedia.org/wiki/Intel_80486' },
  pentium66: { label: 'Wikipedia: Intel Pentium', url: 'https://en.wikipedia.org/wiki/Intel_Pentium' },
  ps1: { label: 'Wikipedia: PlayStation (Konsole)', url: 'https://en.wikipedia.org/wiki/PlayStation_(console)' },
  n64: { label: 'Wikipedia: Nintendo 64', url: 'https://en.wikipedia.org/wiki/Nintendo_64' },
  pentium2: { label: 'Wikipedia: Intel Pentium II', url: 'https://en.wikipedia.org/wiki/Intel_Pentium_II' },
  p3: { label: 'Wikipedia: Intel Pentium III', url: 'https://en.wikipedia.org/wiki/Intel_Pentium_III' },
  ps2: { label: 'Wikipedia: PlayStation 2', url: 'https://en.wikipedia.org/wiki/PlayStation_2' },
  xbox360: { label: 'Wikipedia: Xbox 360', url: 'https://en.wikipedia.org/wiki/Xbox_360' },
  a7: { label: 'Wikipedia: Apple A7', url: 'https://en.wikipedia.org/wiki/Apple_A7' },
  ps4: { label: 'Wikipedia: PlayStation 4', url: 'https://en.wikipedia.org/wiki/PlayStation_4' },
  i7: { label: 'Wikipedia: Intel Core i7-4770', url: 'https://en.wikipedia.org/wiki/Intel_Core_i7-4770' },
  switch: { label: 'Wikipedia: Nintendo Switch', url: 'https://en.wikipedia.org/wiki/Nintendo_Switch' },
  m1: { label: 'Wikipedia: Apple M1', url: 'https://en.wikipedia.org/wiki/Apple_M1' },
  ps5: { label: 'Wikipedia: PlayStation 5', url: 'https://en.wikipedia.org/wiki/PlayStation_5' },
  rtx4090: { label: 'Wikipedia: GeForce RTX 4090', url: 'https://en.wikipedia.org/wiki/GeForce_RTX_40_Serie' },
  r9: { label: 'Wikipedia: Ryzen 9 7950X', url: 'https://en.wikipedia.org/wiki/AMD_Ryzen_9' },
  frontier: { label: 'Wikipedia: Frontier (TOP500)', url: 'https://en.wikipedia.org/wiki/Frontier_(supercomputer)' },
  i4004: { label: 'Wikipedia: Intel 4004', url: 'https://en.wikipedia.org/wiki/Intel_4004' },
  cdc6600: { label: 'Wikipedia: CDC 6600', url: 'https://en.wikipedia.org/wiki/CDC_6600' },
  vectrex: { label: 'Wikipedia: Vectrex', url: 'https://en.wikipedia.org/wiki/Vectrex' },
  genesis: { label: 'Wikipedia: Sega Mega Drive', url: 'https://en.wikipedia.org/wiki/Sega_Mega_Drive' },
  snes: { label: 'Wikipedia: Super Nintendo Entertainment System', url: 'https://en.wikipedia.org/wiki/Super_Nintendo_Entertainment_System' },
  jaguar: { label: 'Wikipedia: Atari Jaguar', url: 'https://en.wikipedia.org/wiki/Atari_Jaguar' },
  dreamcast: { label: 'Wikipedia: Dreamcast', url: 'https://en.wikipedia.org/wiki/Dreamcast' },
  gamecube: { label: 'Wikipedia: GameCube', url: 'https://en.wikipedia.org/wiki/GameCube' },
  xbox: { label: 'Wikipedia: Xbox (Konsole)', url: 'https://en.wikipedia.org/wiki/Xbox_(console)' },
  rpi4: { label: 'Wikipedia: Raspberry Pi 4', url: 'https://en.wikipedia.org/wiki/Raspberry_Pi_4' },
  rpi5: { label: 'Wikipedia: Raspberry Pi 5', url: 'https://en.wikipedia.org/wiki/Raspberry_Pi_5' },
  seriesx: { label: 'Wikipedia: Xbox Series X', url: 'https://en.wikipedia.org/wiki/Xbox_Series_X' },
}

for (const machine of REFERENCE_MACHINES) {
  machine.source = SOURCES[machine.id] ?? null
}

/** Reihenfolge, in der die Zeit-Vergleichsbalken zeigen (interessanteste Stützpunkte). */
export const TIMEBAR_IDS = ['eniac', 'agc', 'c64', 'gameboy', 'pentium66', 'p3', 'ps5', 'rtx4090']

export function referenceById(id: string): ReferenceMachine | null {
  return REFERENCE_MACHINES.find((m) => m.id === id) ?? null
}

/**
 * Sekunden, die die Referenz braucht, um das zu rechnen, was die eigene
 * Maschine in `seconds` (Standard: 1 s) schafft. `null` bei 0-Werten.
 */
export function secondsForReference(ownFlops: number, referenceGflops: number, seconds = 1): number | null {
  if (!Number.isFinite(ownFlops) || ownFlops <= 0 || !Number.isFinite(referenceGflops) || referenceGflops <= 0) return null
  return (ownFlops * seconds) / (referenceGflops * 1e9)
}

/** Wie oft ist die eigene Maschine schneller als die Referenz? */
export function speedFactor(ownFlops: number, referenceGflops: number): number | null {
  if (!Number.isFinite(ownFlops) || ownFlops <= 0 || !Number.isFinite(referenceGflops) || referenceGflops <= 0) return null
  return ownFlops / (referenceGflops * 1e9)
}

/** Deutsche Zahl mit SI-Präfix für Diagramm-Achsen (1,2 GFLOPS, 3,4 TFLOPS …). */
export function siValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return '—'
  const steps: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
  ]
  const abs = Math.abs(value)
  for (const [factor, prefix] of steps) {
    if (abs >= factor) {
      const n = value / factor
      const digits = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2
      return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(n)} ${prefix}${unit}`
    }
  }
  return `${new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 3 }).format(value)} ${unit}`
}
