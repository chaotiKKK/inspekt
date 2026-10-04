/**
 * Enum code → German label. Windows/SMBIOS ship raw integers; every map here
 * returns `null` for codes it does not know so the UI can fall back to the
 * raw value instead of printing something wrong.
 */

function map<T extends string | number>(table: Record<number, T>): (code: number | null | undefined) => T | null {
  return (code) => {
    if (code === null || code === undefined || !Number.isFinite(code)) return null
    return table[code] ?? null
  }
}

export const memoryType = map({
  1: 'Andere',
  2: 'Unbekannt',
  3: 'DRAM',
  4: 'EDRAM',
  5: 'VRAM',
  6: 'SRAM',
  17: 'SDRAM',
  18: 'SGRAM',
  19: 'RDRAM',
  20: 'DDR',
  21: 'DDR2',
  22: 'DDR2 FB-DIMM',
  24: 'DDR3',
  25: 'FBD2',
  26: 'DDR4',
  27: 'LPDDR',
  28: 'LPDDR2',
  29: 'LPDDR3',
  30: 'LPDDR4',
  32: 'Logical non-volatile device',
  33: 'HBM',
  34: 'DDR5',
  35: 'LPDDR5',
  36: 'HBM3',
})

export const memoryTypeShort = (code: number | null | undefined): string | null => {
  const full = memoryType(code)
  if (!full) return null
  return full.startsWith('LPDDR') ? full : full.replace(' FB-DIMM', '')
}

export const formFactor = map({
  1: 'Andere',
  2: 'Unbekannt',
  3: 'SIMM',
  4: 'SIP',
  5: 'Chip',
  6: 'DIP',
  7: 'ZIP',
  8: 'Proprietäre Karte',
  9: 'DIMM',
  10: 'TSOP',
  11: 'RIMM',
  12: 'SO-DIMM',
  13: 'SRIMM',
  14: 'FB-DIMM',
  15: 'Die',
})

export const errorCorrection = map({
  1: 'Andere',
  2: 'Unbekannt',
  3: 'Keine',
  4: 'Parität',
  5: 'Ein-Bit-ECC',
  6: 'Mehr-Bit-ECC',
  7: 'CRC',
})

export const arrayLocation = map({
  1: 'Andere',
  2: 'Unbekannt',
  3: 'Hauptplatine',
  4: 'Erweiterungsplatine',
  5: 'Server-Platine',
  6: 'Massenspeicher-Slot (Mini-Slot)',
  7: 'Massenspeicher-Slot',
  8: 'Festplatten-Bay',
  9: 'Sichere Massenspeicher-Bay',
  10: 'Massenspeicher-Slot (PCI Express)',
  11: 'Massenspeicher-Bay (PCI Express)',
  12: 'Primärer System-Bay',
  13: 'Primärer System-Bay (PCI Express)',
  14: 'Sekundärer System-Bay',
  15: 'Sekundärer System-Bay (PCI Express)',
})

export const chassisType = map({
  1: 'Andere',
  2: 'Unbekannt',
  3: 'Desktop',
  4: 'Kompakt-Desktop',
  5: 'Pizza-Box',
  6: 'Mini-Tower',
  7: 'Tower',
  8: 'Portabel',
  9: 'Laptop',
  10: 'Notebook',
  11: 'Handheld',
  12: 'Docking-Station',
  13: 'Alles-in-einem',
  14: 'Sub-Notebook',
  15: 'Platzsparend',
  16: 'Lunch-Box',
  17: 'Server-Chassis',
  18: 'Erweiterungs-Chassis',
  19: 'Sub-Chassis',
  20: 'Bus-Erweiterungs-Chassis',
  21: 'Peripherie-Chassis',
  22: 'RAID-Chassis',
  23: 'Rack-Mount-Chassis',
  24: 'Versiegelter PC',
  25: 'Mehrsystem-Chassis',
  26: 'CompactPCI',
  27: 'AdvancedTCA',
  28: 'Blade',
  29: 'Blade-Gehäuse',
  30: 'Tablet',
  31: 'Convertible',
  32: 'Abnehmbar',
  33: 'IoT-Gateway',
  34: 'Eingebetteter PC',
  35: 'Mini-PC',
  36: 'Stick-PC',
})

export const pcSystemType = map({
  1: 'Unbekannt',
  2: 'Mobil',
  3: 'Desktop',
  4: 'Workstation',
  5: 'Enterprise-Server',
  6: 'SMB-Server',
  7: 'Appliance',
  8: 'Performance-Server',
  9: 'Slo',
})

export const batteryChemistry = map({
  1: 'Andere',
  2: 'Unbekannt',
  3: 'Lithium-Ion',
  4: 'Lithium-Polymer',
  5: 'Lithium-Eisenphosphat',
  6: 'Blei-Säure',
  7: 'Nickel-Cadmium',
  8: 'Nickel-Metallhydrid',
  9: 'Alkaline',
  10: 'Lithium-Carbon',
  11: 'Lithium-Mangandioxid',
  12: 'Lithium-Schwefeldioxid',
  13: 'Silberoxid',
  14: 'Zink-Luft',
  15: 'Silber-Zink',
})

export const batteryStatus = map({
  1: 'Andere',
  2: 'Unbekannt',
  3: 'Vollgeladen',
  4: 'Niedrig',
  5: 'Kritisch',
  6: 'Wird geladen',
  7: 'Wird geladen (hoch)',
  8: 'Wird geladen (niedrig)',
  9: 'Wird geladen (kritisch)',
  10: 'Undefiniert',
  11: 'Teilgeladen',
})

export const monitorOutput = map({
  1: 'Andere',
  2: 'Unbekannt',
  3: 'DVI',
  4: 'HDMI',
  5: 'DisplayPort',
  6: 'VGA (analog)',
  7: 'DVI-I',
  8: 'DVI-D',
  9: 'DVI-A',
  10: 'DisplayPort (mini)',
  11: 'DisplayPort (intern)',
  12: 'Thunderbolt',
})

export function monitorOutputLabel(code: number | null | undefined): string | null {
  if (code === null || code === undefined || !Number.isFinite(code)) return null
  if (code >= 0x80000000) return 'Intern (eDP)'
  return monitorOutput(code) ?? `Code ${code}`
}

export const deviceClasses: Record<string, string> = {
  Net: 'Netzwerk',
  NetClient: 'Netzwerkclient',
  NetTransports: 'Netzwerk-Protokoll',
  NetServices: 'Netzwerk-Dienst',
  NetSoftwareD: 'Netzwerk-Software',
  NetDialUp: 'Einwahl',
  NetOSI: 'Netzwerk',
  NetProtocol: 'Netzwerk-Protokoll',
  USB: 'USB-Controller',
  USBDevice: 'USB-Gerät',
  USBPrinters: 'USB-Drucker',
  HIDClass: 'Eingabegerät (HID)',
  Display: 'Grafik',
  Monitor: 'Monitor',
  DiskDrive: 'Datenträger',
  CDROM: 'Optisches Laufwerk',
  CDACER: 'Optisches Laufwerk',
  Volume: 'Datenträger',
  Vol: 'Datenträger',
  SCSIAdapter: 'SCSI-Adapter',
  SCSIChanger: 'Wechsler',
  HDC: 'Speichercontroller',
  Processor: 'Prozessor',
  System: 'System',
  SystemClass: 'System',
  BIOS: 'BIOS',
  Battery: 'Akku',
  MTD: 'Speichermodul',
  MTDACR: 'Speichermodul',
  Ports: 'Serielle/parallele Ports',
  Modem: 'Modem',
  Media: 'Medien',
  HDAudio: 'Audio',
  AudioEndpoint: 'Audio-Ausgabe',
  Camera: 'Kamera',
  Image: 'Bild',
  ImageProc: 'Bildverarbeitung',
  Scanner: 'Scanner',
  FDC: 'Diskettenlaufwerk',
  FloppyDisk: 'Diskettenlaufwerk',
  InfiniBand: 'InfiniBand',
  IBPrint: 'Drucker',
  PCMCIA: 'PCMCIA',
  PCMCIAAdap: 'PCMCIA',
  PCMCIAEnum: 'PCMCIA',
  MultiportSerial: 'Multiport-Seriell',
  SecurityDevice: 'Sicherheitsgerät',
  Ensec: 'Sicherheit',
  SmartCardReader: 'Smartcard-Leser',
  Biometric: 'Biometrie',
  Bluetooth: 'Bluetooth',
  SoftwareComponent: 'Software-Komponente',
  SoftwareDevice: 'Software-Gerät',
  SPD: 'Sensoren',
  SPDA: 'Sensoren',
  Sensor: 'Sensor',
  ACPI: 'ACPI',
  ACPIHal: 'ACPI',
  Host: 'Host-Adapter',
  PCI: 'PCI-Gerät',
  Keyboard: 'Tastatur',
  Mouse: 'Maus',
  Printer: 'Drucker',
  PrinterClass: 'Drucker',
  LPTENUM: 'Drucker',
  TapeDrive: 'Bandlaufwerk',
  NTMSClass: 'Band',
  Infrared: 'Infrarot',
  Serial: 'Seriell',
  1394: 'FireWire',
  Ieee1394: 'FireWire',
  TCPIP: 'TCP/IP',
  Computech: 'Controller',
  Other: 'Sonstiges',
}

export function deviceClass(code: string | null | undefined): string {
  if (!code) return 'Ohne Klasse'
  return deviceClasses[code] ?? code
}

export function healthLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const table: Record<string, string> = {
    Healthy: 'Healthy',
    Warning: 'Warnung',
    Critical: 'Kritisch',
    Unknown: 'Unbekannt',
    'Pred Fail': 'Vorab-Fehler',
    Error: 'Fehler',
    OK: 'OK',
  }
  return table[value] ?? value
}

export type HealthTone = 'good' | 'warn' | 'bad' | 'neutral'

export function healthTone(value: string | null | undefined): HealthTone {
  if (!value) return 'neutral'
  const v = value.toLowerCase()
  if (v === 'healthy' || v === 'ok' || v === 'good') return 'good'
  if (v === 'warning' || v === 'pred fail' || v === 'caution') return 'warn'
  if (v === 'critical' || v === 'error' || v === 'failure' || v === 'failed') return 'bad'
  return 'neutral'
}

export function isLaptop(chassisTypes: number[] | null | undefined, pcSystemType: number | null | undefined): boolean {
  const mobileChassis = [8, 9, 10, 11, 14, 30, 31, 32]
  if (chassisTypes?.some((t) => mobileChassis.includes(t))) return true
  return pcSystemType === 2
}

export function chassisLabel(chassisTypes: number[] | null | undefined): string | null {
  if (!chassisTypes || chassisTypes.length === 0) return null
  const labels = chassisTypes.map((t) => chassisType(t) ?? `Code ${t}`)
  return [...new Set(labels)].join(', ')
}
