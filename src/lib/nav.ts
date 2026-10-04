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
  label: string
  /** Silkscreen designator, printed left of the label like on a PCB. */
  code: string
  icon: string
  /** Sections that can be refreshed individually. */
  sections: string[]
}

export const NAV: NavItem[] = [
  { id: 'overview', label: 'Übersicht', code: 'SYS', icon: 'LayoutDashboard', sections: ['system', 'cpu', 'memory', 'storage'] },
  { id: 'memory', label: 'Arbeitsspeicher', code: 'DIMM', icon: 'MemoryStick', sections: ['memory', 'sensors'] },
  { id: 'storage', label: 'Speicher', code: 'STG', icon: 'HardDrive', sections: ['storage'] },
  { id: 'cpu', label: 'Prozessor', code: 'CPU', icon: 'Cpu', sections: ['cpu'] },
  { id: 'gpu', label: 'Grafik', code: 'GPU', icon: 'MonitorCog', sections: ['gpu'] },
  { id: 'bench', label: 'Rechenkraft', code: 'FLO', icon: 'Gauge', sections: ['cpu', 'memory', 'sensors'] },
  { id: 'board', label: 'Mainboard & BIOS', code: 'MB', icon: 'CircuitBoard', sections: ['system', 'security'] },
  { id: 'monitors', label: 'Monitore', code: 'LCD', icon: 'Monitor', sections: ['monitors'] },
  { id: 'network', label: 'Netzwerk', code: 'NIC', icon: 'Network', sections: ['network'] },
  { id: 'devices', label: 'Geräte', code: 'PNP', icon: 'Usb', sections: ['devices'] },
  { id: 'battery', label: 'Akku', code: 'BAT', icon: 'BatteryCharging', sections: ['battery'] },
  { id: 'sensors', label: 'Sensoren', code: 'TMP', icon: 'Thermometer', sections: ['sensors'] },
  { id: 'export', label: 'System & Export', code: 'EXP', icon: 'FileDown', sections: [] },
]

export function navItem(id: NavId): NavItem {
  return NAV.find((n) => n.id === id) ?? NAV[0]
}
