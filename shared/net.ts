/** Gerät im lokalen Netz, gefunden ueber ARP oder Ping. */
export interface LanDevice {
  ip: string
  mac: string | null
  vendor: string | null
  hostname: string | null
  source: 'arp' | 'ping' | 'eigener-host'
}

export interface NetScanResult {
  startedAt: number
  ms: number
  /** geprüftes Subnetz, z. B. "192.168.1.0/24" */
  subnet: string | null
  interfaceName: string | null
  /** Anzahl der geprüften Adressen */
  probed: number
  devices: LanDevice[]
  /** Hinweise, warum nicht alles gefunden wurde */
  note: string | null
}

export interface NetScanProgress {
  done: number
  total: number
  found: number
}