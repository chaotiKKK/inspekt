import { t } from './i18n.ts'

export type NavId =
  | 'overview'
  | 'memory'
  | 'storage'
  | 'cpu'
  | 'gpu'
  | 'bench'
  | 'board'
  | 'monitors'
  | 'network'
  | 'devices'
  | 'battery'
  | 'sensors'
  | 'export'

export interface NavItem {
  id: NavId
  /** Schlüssel für die Übersetzung, deutsche Fassung als Fallback */
  labelKey: string
  label: string
  /** Silkscreen designator, printed left of the label like on a PCB. */
  code: string
  icon: string
  /** Sections that can be refreshed individually. */
  sections: string[]
}

export const NAV: NavItem[] = [
  { id: 'overview', labelKey: 'nav.overview', label: 'Übersicht', code: 'SYS', icon: 'LayoutDashboard', sections: ['system', 'cpu', 'memory', 'storage'] },
  { id: 'memory', labelKey: 'nav.memory', label: 'Arbeitsspeicher', code: 'DIMM', icon: 'MemoryStick', sections: ['memory', 'sensors'] },
  { id: 'storage', labelKey: 'nav.storage', label: 'Speicher', code: 'STG', icon: 'HardDrive', sections: ['storage'] },
  { id: 'cpu', labelKey: 'nav.cpu', label: 'Prozessor', code: 'CPU', icon: 'Cpu', sections: ['cpu'] },
  { id: 'gpu', labelKey: 'nav.gpu', label: 'Grafik', code: 'GPU', icon: 'MonitorCog', sections: ['gpu'] },
  { id: 'bench', labelKey: 'nav.bench', label: 'Rechenkraft', code: 'FLO', icon: 'Gauge', sections: ['cpu', 'memory', 'sensors'] },
  { id: 'board', labelKey: 'nav.board', label: 'Mainboard & BIOS', code: 'MB', icon: 'CircuitBoard', sections: ['system', 'security'] },
  { id: 'monitors', labelKey: 'nav.monitors', label: 'Monitore', code: 'LCD', icon: 'Monitor', sections: ['monitors'] },
  { id: 'network', labelKey: 'nav.network', label: 'Netzwerk', code: 'NIC', icon: 'Network', sections: ['network'] },
  { id: 'devices', labelKey: 'nav.devices', label: 'Geräte', code: 'PNP', icon: 'Usb', sections: ['devices'] },
  { id: 'battery', labelKey: 'nav.battery', label: 'Akku', code: 'BAT', icon: 'BatteryCharging', sections: ['battery'] },
  { id: 'sensors', labelKey: 'nav.sensors', label: 'Sensoren', code: 'TMP', icon: 'Thermometer', sections: ['sensors'] },
  { id: 'export', labelKey: 'nav.export', label: 'System & Export', code: 'EXP', icon: 'FileDown', sections: [] },
]

/** Anzeigename eines Bereichs in der aktuellen Sprache. */
export function navLabel(item: NavItem): string {
  return t(item.labelKey, item.label)
}

export function navItem(id: NavId): NavItem {
  return NAV.find((n) => n.id === id) ?? NAV[0]
}