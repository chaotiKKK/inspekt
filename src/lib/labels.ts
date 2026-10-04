/**
 * Enum-Code → Anzeigename. Windows und SMBIOS liefern rohe Zahlen; jede Tabelle
 * hier gibt `null` für unbekannte Codes zurück, damit die Oberfläche den
 * Rohwert zeigt statt etwas Falsches zu behaupten.
 *
 * Die deutschen Werte sind zugleich der Fallback. Für Englisch läuft jeder
 * Wert durch ein Wörterbuch; was dort nicht steht (DDR5, HDMI, Vendor-Namen)
 * bleibt bewusst unverändert.
 */
import { registriere, t } from './i18n.ts'

/** Deutscher Begriff → englische Entsprechung. Alles andere bleibt wie er ist. */
const WOERTER: Record<string, string> = {
  Andere: 'Other',
  Unbekannt: 'Unknown',
  Undefiniert: 'Undefined',
  'Unbekannter Platz': 'Unknown slot',

  // Speicherarten
  'Logisches nichtflüchtiges Gerät': 'Logical non-volatile device',

  // Formfaktoren
  'Proprietäre Karte': 'Proprietary card',
  Chip: 'Chip',
  'Die': 'Die',

  // Fehlerkorrektur
  Keine: 'None',
  Parität: 'Parity',
  'Ein-Bit-ECC': 'Single-bit ECC',
  'Mehr-Bit-ECC': 'Multi-bit ECC',

  // Array-Positionen
  Hauptplatine: 'Motherboard',
  Erweiterungsplatine: 'Daughter board',
  'Server-Platine': 'Server board',
  'Massenspeicher-Slot': 'Bulk memory slot',
  'Massenspeicher-Slot (Mini-Slot)': 'Bulk memory slot (mini-slot)',
  'Massenspeicher-Bay': 'Bulk memory bay',
  'Sichere Massenspeicher-Bay': 'Secure bulk memory bay',
  'Massenspeicher-Slot (PCI Express)': 'Bulk memory slot (PCI Express)',
  'Massenspeicher-Bay (PCI Express)': 'Bulk memory bay (PCI Express)',
  'Primärer System-Bay': 'Primary system bay',
  'Primärer System-Bay (PCI Express)': 'Primary system bay (PCI Express)',
  'Sekundärer System-Bay': 'Secondary system bay',
  'Sekundärer System-Bay (PCI Express)': 'Secondary system bay (PCI Express)',
  'Festplatten-Bay': 'Hard disk bay',

  // Gehäuse
  Desktop: 'Desktop',
  'Kompakt-Desktop': 'Compact desktop',
  'Pizza-Box': 'Pizza box',
  'Mini-Tower': 'Mini tower',
  Tower: 'Tower',
  Portabel: 'Portable',
  Laptop: 'Laptop',
  Notebook: 'Notebook',
  Handheld: 'Handheld',
  'Docking-Station': 'Docking station',
  'Alles-in-einem': 'All-in-one',
  'Sub-Notebook': 'Sub-notebook',
  Platzsparend: 'Space-saving',
  'Lunch-Box': 'Lunch box',
  'Server-Chassis': 'Server chassis',
  'Erweiterungs-Chassis': 'Expansion chassis',
  'Sub-Chassis': 'Sub chassis',
  'Bus-Erweiterungs-Chassis': 'Bus expansion chassis',
  'Peripherie-Chassis': 'Peripheral chassis',
  'RAID-Chassis': 'RAID chassis',
  'Rack-Mount-Chassis': 'Rack-mount chassis',
  'Versiegelter PC': 'Sealed-case PC',
  'Mehrsystem-Chassis': 'Multi-system chassis',
  Blade: 'Blade',
  'Blade-Gehäuse': 'Blade enclosure',
  Tablet: 'Tablet',
  Convertible: 'Convertible',
  Abnehmbar: 'Detachable',
  'IoT-Gateway': 'IoT gateway',
  'Eingebetteter PC': 'Embedded PC',
  'Mini-PC': 'Mini PC',
  'Stick-PC': 'Stick PC',
  'Slo': 'SLO',

  // Systemtyp
  Mobil: 'Mobile',
  Workstation: 'Workstation',
  'Enterprise-Server': 'Enterprise server',
  'SMB-Server': 'SMB server',
  Appliance: 'Appliance',
  'Performance-Server': 'Performance server',

  // Akku
  'Lithium-Ion': 'Lithium-ion',
  'Lithium-Polymer': 'Lithium-polymer',
  'Lithium-Eisenphosphat': 'Lithium iron phosphate',
  'Blei-Säure': 'Lead-acid',
  'Nickel-Cadmium': 'Nickel-cadmium',
  'Nickel-Metallhydrid': 'Nickel-metal hydride',
  Alkaline: 'Alkaline',
  'Lithium-Carbon': 'Lithium-carbon',
  'Lithium-Mangandioxid': 'Lithium-manganese dioxide',
  'Lithium-Schwefeldioxid': 'Lithium-sulfur dioxide',
  Silberoxid: 'Silver oxide',
  'Zink-Luft': 'Zinc-air',
  'Silber-Zink': 'Silver-zinc',
  Vollgeladen: 'Fully charged',
  Niedrig: 'Low',
  Kritisch: 'Critical',
  'Wird geladen': 'Charging',
  'Wird geladen (hoch)': 'Charging (high)',
  'Wird geladen (niedrig)': 'Charging (low)',
  'Wird geladen (kritisch)': 'Charging (critical)',
  Teilgeladen: 'Partially charged',

  // Monitor
  'VGA (analog)': 'VGA (analog)',
  'DVI-I': 'DVI-I',
  'DVI-D': 'DVI-D',
  'DVI-A': 'DVI-A',
  'DisplayPort (mini)': 'DisplayPort (mini)',
  'DisplayPort (intern)': 'DisplayPort (internal)',
  'Intern (eDP)': 'Internal (eDP)',

  // Geräteklassen
  Netzwerk: 'Network',
  Netzwerkclient: 'Network client',
  'Netzwerk-Protokoll': 'Network protocol',
  'Netzwerk-Dienst': 'Network service',
  'Netzwerk-Software': 'Network software',
  Einwahl: 'Dial-up',
  'USB-Controller': 'USB controller',
  'USB-Gerät': 'USB device',
  'USB-Drucker': 'USB printer',
  'Eingabegerät (HID)': 'Input device (HID)',
  Grafik: 'Graphics',
  Monitor: 'Monitor',
  Datenträger: 'Disk drive',
  'Optisches Laufwerk': 'Optical drive',
  'SCSI-Adapter': 'SCSI adapter',
  Wechsler: 'Changer',
  Speichercontroller: 'Storage controller',
  Prozessor: 'Processor',
  System: 'System',
  BIOS: 'BIOS',
  Akku: 'Battery',
  Speichermodul: 'Memory module',
  'Serielle/parallele Ports': 'Serial/parallel ports',
  Modem: 'Modem',
  Medien: 'Media',
  Audio: 'Audio',
  'Audio-Ausgabe': 'Audio output',
  Kamera: 'Camera',
  Bild: 'Image',
  Bildverarbeitung: 'Image processing',
  Scanner: 'Scanner',
  Diskettenlaufwerk: 'Floppy drive',
  InfiniBand: 'InfiniBand',
  Drucker: 'Printer',
  'Bandlaufwerk': 'Tape drive',
  Band: 'Tape',
  Infrarot: 'Infrared',
  Seriell: 'Serial',
  FireWire: 'FireWire',
  Controller: 'Controller',
  Sonstiges: 'Other',
  'Ohne Klasse': 'No class',
  'Sicherheitsgerät': 'Security device',
  Sicherheit: 'Security',
  'Smartcard-Leser': 'Smart card reader',
  Biometrie: 'Biometrics',
  'Software-Komponente': 'Software component',
  'Software-Gerät': 'Software device',
  Sensoren: 'Sensors',
  Sensor: 'Sensor',
  ACPI: 'ACPI',
  'Host-Adapter': 'Host adapter',
  'PCI-Gerät': 'PCI device',
  Tastatur: 'Keyboard',
  Maus: 'Mouse',
  'Multiport-Seriell': 'Multiport serial',

  // Zustände
  Warnung: 'Warning',
  'Vorab-Fehler': 'Predicted failure',
  Fehler: 'Error',
  'Code {code}': 'Code {code}',
}

const TABELLEN = {
  memoryType: {
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
    32: 'Logisches nichtflüchtiges Gerät',
    33: 'HBM',
    34: 'DDR5',
    35: 'LPDDR5',
    36: 'HBM3',
  },
  formFactor: {
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
  },
  errorCorrection: {
    1: 'Andere',
    2: 'Unbekannt',
    3: 'Keine',
    4: 'Parität',
    5: 'Ein-Bit-ECC',
    6: 'Mehr-Bit-ECC',
    7: 'CRC',
  },
  arrayLocation: {
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
  },
  chassisType: {
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
  },
  pcSystemType: {
    1: 'Unbekannt',
    2: 'Mobil',
    3: 'Desktop',
    4: 'Workstation',
    5: 'Enterprise-Server',
    6: 'SMB-Server',
    7: 'Appliance',
    8: 'Performance-Server',
    9: 'Slo',
  },
  batteryChemistry: {
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
  },
  batteryStatus: {
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
  },
  monitorOutput: {
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
  },
} as const

const KLASSEN: Record<string, string> = {
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

const ZUSTAND: Record<string, string> = {
  Healthy: 'Healthy',
  Warning: 'Warnung',
  Critical: 'Kritisch',
  Unknown: 'Unbekannt',
  'Pred Fail': 'Vorab-Fehler',
  Error: 'Fehler',
  OK: 'OK',
}

// Schlüssel anmelden: DE bleibt der deutsche Wert, EN kommt aus dem Wörterbuch
for (const [gruppe, tabelle] of Object.entries(TABELLEN)) {
  const de: Record<string, string> = {}
  const en: Record<string, string> = {}
  for (const [code, wert] of Object.entries(tabelle)) {
    de[`label.${gruppe}.${code}`] = wert
    en[`label.${gruppe}.${code}`] = WOERTER[wert] ?? wert
  }
  registriere({ de, en })
}

{
  const de: Record<string, string> = {}
  const en: Record<string, string> = {}
  for (const [code, wert] of Object.entries(KLASSEN)) {
    de[`label.device.${code}`] = wert
    en[`label.device.${code}`] = WOERTER[wert] ?? wert
  }
  for (const [wert, deutsch] of Object.entries(ZUSTAND)) {
    de[`label.health.${wert}`] = deutsch
    en[`label.health.${wert}`] = wert
  }
  // Einzelwerte, die nicht aus einer Tabelle kommen
  de['label.device.none'] = 'Ohne Klasse'
  en['label.device.none'] = 'No class'
  de['label.monitor.internal'] = 'Intern (eDP)'
  en['label.monitor.internal'] = 'Internal (eDP)'
  de['label.code'] = 'Code {code}'
  en['label.code'] = 'Code {code}'
  registriere({ de, en })
}

function map(gruppe: string, tabelle: Record<number, string>): (code: number | null | undefined) => string | null {
  return (code) => {
    if (code === null || code === undefined || !Number.isFinite(code)) return null
    const wert = tabelle[code]
    if (wert === undefined) return null
    return t(`label.${gruppe}.${code}`, wert)
  }
}

export const memoryType = map('memoryType', TABELLEN.memoryType)

export const memoryTypeShort = (code: number | null | undefined): string | null => {
  const full = memoryType(code)
  if (!full) return null
  return full.startsWith('LPDDR') ? full : full.replace(' FB-DIMM', '')
}

export const formFactor = map('formFactor', TABELLEN.formFactor)
export const errorCorrection = map('errorCorrection', TABELLEN.errorCorrection)
export const arrayLocation = map('arrayLocation', TABELLEN.arrayLocation)
export const chassisType = map('chassisType', TABELLEN.chassisType)
export const pcSystemType = map('pcSystemType', TABELLEN.pcSystemType)
export const batteryChemistry = map('batteryChemistry', TABELLEN.batteryChemistry)
export const batteryStatus = map('batteryStatus', TABELLEN.batteryStatus)
export const monitorOutput = map('monitorOutput', TABELLEN.monitorOutput)

export function monitorOutputLabel(code: number | null | undefined): string | null {
  if (code === null || code === undefined || !Number.isFinite(code)) return null
  if (code >= 0x80000000) return t('label.monitor.internal', 'Intern (eDP)')
  return monitorOutput(code) ?? t('label.code', 'Code {code}', { code })
}

/** rohe SMBIOS-Klasse → übersetzte Anzeige */
export function deviceClass(code: string | null | undefined): string {
  if (!code) return t('label.device.none', 'Ohne Klasse')
  const wert = KLASSEN[code]
  if (wert === undefined) return code
  return t(`label.device.${code}`, wert)
}

export function healthLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const deutsch = ZUSTAND[value]
  if (deutsch === undefined) return value
  return t(`label.health.${value}`, deutsch)
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

export function isLaptop(chassisTypes: number[] | null | undefined, pcSystemTypeCode: number | null | undefined): boolean {
  const mobileChassis = [8, 9, 10, 11, 14, 30, 31, 32]
  if (chassisTypes?.some((type) => mobileChassis.includes(type))) return true
  return pcSystemTypeCode === 2
}

export function chassisLabel(chassisTypes: number[] | null | undefined): string | null {
  if (!chassisTypes || chassisTypes.length === 0) return null
  const labels = chassisTypes.map((type) => chassisType(type) ?? t('label.code', 'Code {code}', { code: type }))
  return [...new Set(labels)].join(', ')
}