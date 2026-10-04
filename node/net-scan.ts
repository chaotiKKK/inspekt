import { execFile } from 'node:child_process'
import os from 'node:os'
import { promisify } from 'node:util'
import type { LanDevice, NetScanResult } from '../shared/net.ts'
import { powershellExe } from './collect.ts'

const run = promisify(execFile)

export type { LanDevice, NetScanResult }

/**
 * Herstellerzuordnung Ã¼ber die ersten drei Bytes der MAC.
 * Kuratiert statt vollstÃ¤ndig â€“ die IEEE-Datenbank hat Ã¼ber 50.000 EintrÃ¤ge,
 * die gÃ¤ngigsten deckt diese Liste ab. Fehlende PrÃ¤fixe bleiben "unbekannt",
 * statt zu raten.
 */
const VENDORS: Record<string, string> = {
  '00:1a:11': 'Google', '00:1b:63': 'Apple', '00:1c:b3': 'Apple', '00:1d:0f': 'Technicolor',
  '00:23:12': 'Apple', '00:25:00': 'Apple', '00:26:bb': 'Apple', '00:50:56': 'VMware',
  '08:00:27': 'VirtualBox', '0c:80:63': 'TP-Link', '1c:bf:ce': 'Shelly', '24:0a:c4': 'Espressif',
  '24:4b:fe': 'ASUSTek', '24:60:7c': 'ASRock', '28:80:88': 'Hewlett Packard', '34:60:f9': 'ASUSTek',
  '3c:7c:3f': 'ASUSTek', '40:16:9e': 'LG Electronics', '40:5a:36': 'B-Link', '44:07:0b': 'Google',
  '48:d8:90': 'Apple', '4c:cc:6a': 'ASRock', '50:65:41': 'Apple', '5c:f9:38': 'Apple',
  '60:e3:27': 'Samsung', '64:2f:d9': 'Espressif', '64:87:88': 'OnePlus', '68:67:25': 'Amazon',
  '6c:b2:6b': 'Sonos', '70:2a:d8': 'Raspberry Pi Foundation', '70:85:c2': 'ASRock',
  '74:83:c2': 'ASUSTek', '78:8b:2a': 'Ubiquiti', '7c:2e:bd': 'Google', '80:2a:a8': 'Ubiquiti',
  '80:3f:43': 'Microsoft', '84:7b:eb': 'Intel', '88:71:b1': 'Cisco', '8c:85:80': 'Apple',
  '90:6c:ac': 'Fiberhome', '94:65:2d': 'OnePlus', '98:5a:eb': 'Samsung', 'a0:b1:c0': 'Zyxel',
  'a4:2b:b0': 'TP-Link', 'a4:cf:12': 'Espressif', 'ac:bc:32': 'Huawei', 'b0:be:76': 'TP-Link',
  'b4:2e:99': 'Netgear', 'b8:27:eb': 'Raspberry Pi Foundation', 'bc:ad:28': 'AzureWave',
  'c0:25:06': 'TP-Link', 'c4:2f:90': 'Realtek', 'c8:3a:35': 'Tenda', 'cc:32:e5': 'Xiaomi',
  'd0:17:c2': 'Espressif', 'd4:6a:a8': 'Hewlett Packard', 'd8:9e:f3': 'Dell', 'dc:a6:32': 'Raspberry Pi Trading',
  'dc:9b:41': 'Espressif', 'e0:18:9e': 'Shenzhen', 'e4:5f:01': 'Raspberry Pi Trading',
  'e8:db:84': 'Espressif', 'ec:fa:bc': 'Alcatel-Lucent', 'f0:18:98': 'Xiaomi', 'f4:f5:e8': 'Google',
  'f8:32:e4': 'Texas Instruments', 'fc:fb:fb': 'Cisco', '00:1d:0f:': 'Technicolor',
}

/** OEM-KÃ¼rzel, die Windows selbst liefert (verlÃ¤sslicher als jede Tabelle). */
const VENDOR_KEYS: Array<[RegExp, string]> = [
  [/Intel/i, 'Intel'], [/Realtek/i, 'Realtek'], [/NVIDIA/i, 'NVIDIA'], [/AMD|Advanced Micro/i, 'AMD'],
  [/Broadcom/i, 'Broadcom'], [/Qualcomm/i, 'Qualcomm'], [/MediaTek/i, 'MediaTek'], [/Samsung/i, 'Samsung'],
  [/Apple/i, 'Apple'], [/Hewlett|HP Inc/i, 'Hewlett Packard'], [/Dell/i, 'Dell'], [/Lenovo/i, 'Lenovo'],
  [/ASUSTeK/i, 'ASUSTek'], [/MSI|Micro-Star/i, 'Micro-Star'], [/Gigabyte/i, 'Gigabyte'],
  [/ASRock/i, 'ASRock'], [/TP-Link|TP-LINK/i, 'TP-Link'], [/Huawei/i, 'Huawei'], [/Xiaomi/i, 'Xiaomi'],
  [/Raspberry/i, 'Raspberry Pi'], [/Espressif/i, 'Espressif'], [/Nordic/i, 'Nordic Semiconductor'],
  [/Texas Instruments/i, 'Texas Instruments'], [/Microchip/i, 'Microchip'], [/NXP/i, 'NXP'],
  [/Analog Devices/i, 'Analog Devices'], [/Infineon/i, 'Infineon'], [/STMicro/i, 'STMicroelectronics'],
  [/LG Electronics/i, 'LG Electronics'], [/Sony/i, 'Sony'], [/Canon/i, 'Canon'], [/Epson/i, 'Epson'],
  [/Brother/i, 'Brother'], [/Logitech/i, 'Logitech'], [/Razer/i, 'Razer'], [/Corsair/i, 'Corsair'],
  [/Google/i, 'Google'], [/Amazon/i, 'Amazon'], [/Microsoft/i, 'Microsoft'], [/VMware/i, 'VMware'],
  [/VirtualBox/i, 'Oracle'], [/QEMU/i, 'QEMU'], [/Cisco/i, 'Cisco'], [/Ubiquiti/i, 'Ubiquiti'],
  [/Netgear/i, 'Netgear'], [/D-Link/i, 'D-Link'], [/Zyxel/i, 'Zyxel'],
  [/Avaya/i, 'Avaya'], [/Polycom/i, 'Polycom'], [/Plantronics/i, 'Plantronics'], [/Anker/i, 'Anker'],
  [/Ugreen/i, 'Ugreen'], [/Synology/i, 'Synology'], [/QNAP/i, 'QNAP'], [/Seagate/i, 'Seagate'],
  [/Western Digital|WDC/i, 'Western Digital'], [/Crucial/i, 'Crucial'], [/Kingston/i, 'Kingston'],
]

export function vendorFromMac(mac: string | null, description?: string | null): string | null {
  if (description) {
    for (const [pattern, name] of VENDOR_KEYS) {
      if (pattern.test(description)) return name
    }
  }
  if (!mac) return null
  const clean = mac.replace(/[^0-9a-f]/gi, '').toUpperCase()
  if (clean.length < 6) return null
  const prefix = `${clean.slice(0, 2)}:${clean.slice(2, 4)}:${clean.slice(4, 6)}`.toLowerCase()
  return VENDORS[prefix] ?? null
}

interface NeighborRow {
  ip: string
  mac: string | null
  state: string
  type: string
}

async function readArpTable(): Promise<NeighborRow[]> {
  const script = `$rows = @()
try {
  $rows = Get-NetNeighbor -AddressFamily IPv4 -ErrorAction Stop | Select-Object IPAddress, LinkLayerAddress, State, IsRouter
} catch {
  try { $rows = arp -a | ForEach-Object { $_ } } catch { $rows = @() }
}
$rows | ForEach-Object {
  $mac = $null
  if ($_.LinkLayerAddress -and $_.LinkLayerAddress -ne '00-00-00-00-00-00') {
    $mac = ($_.LinkLayerAddress -replace '-', ':')
  }
  [pscustomobject]@{ ip = [string]$_.IPAddress; mac = $mac; state = [string]$_.State; type = if ($_.IsRouter) { 'router' } else { 'host' } }
} | ConvertTo-Json -Compress -Depth 3`
  try {
    const { stdout } = await run(
      powershellExe(),
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 },
    )
    const text = stdout.trim()
    if (!text) return []
    const parsed = JSON.parse(text) as NeighborRow | NeighborRow[]
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

/** Aktives Interface mit IPv4 finden und das /24-Netz daraus ableiten. */
export async function activeSubnet(): Promise<{ subnet: string; interfaceName: string | null } | null> {
  const nets = Object.entries(os.networkInterfaces())
  for (const [name, infos] of nets) {
    const ipv4 = (infos ?? []).find((i) => i.family === 'IPv4' && !i.internal)
    if (!ipv4) continue
    const parts = ipv4.address.split('.')
    return { subnet: `${parts[0]}.${parts[1]}.${parts[2]}.0/24`, interfaceName: name }
  }
  return null
}

export interface ScanOptions {
  /** Anzahl zu prÃ¼fender Adressen pro /24 (254) */
  limit?: number
  onProgress?: (done: number, total: number) => void
  signal?: { aborted: boolean }
}

/** Nur Hosts im geprÃ¼ften Subnetz - Broadcast, Multicast und Fremdnetze fliegen raus. */
function isInSubnet(ip: string, prefix: string[] | null): boolean {
  if (!prefix) return false
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  if (parts[0] === '224' || parts[0] === '239' || parts[0] === '255') return false
  if (parts[3] === '255' || parts[3] === '0') return false
  return parts[0] === prefix[0] && parts[1] === prefix[1] && parts[2] === prefix[2]
}

/** Pingt ein /24 in Batches und fÃ¼hrt die Treffer mit der ARP-Tabelle zusammen. */
export async function scanLan(options: ScanOptions = {}): Promise<NetScanResult> {
  const startedAt = Date.now()
  const limit = Math.min(254, Math.max(4, options.limit ?? 254))
  const info = await activeSubnet()
  const base = info ? info.subnet.split('/')[0].split('.') : null
  const prefix = base ? [base[0], base[1], base[2]] : null

  const ownIps = new Set<string>()
  for (const iface of Object.values(os.networkInterfaces()).flatMap((list) => list ?? [])) {
    if (iface.family === 'IPv4' && !iface.internal) ownIps.add(iface.address)
  }

  const found = new Map<string, LanDevice>()

  const arp = await readArpTable()
  for (const row of arp) {
    if (!row.ip || !isInSubnet(row.ip, prefix)) continue
    if (row.state === 'Unreachable' && !ownIps.has(row.ip)) continue
    const mac = row.mac && row.mac !== '00:00:00:00:00:00' ? row.mac : null
    found.set(row.ip, {
      ip: row.ip,
      mac,
      vendor: vendorFromMac(mac),
      hostname: ownIps.has(row.ip) ? os.hostname() : null,
      source: ownIps.has(row.ip) ? 'eigener-host' : 'arp',
    })
  }

  let probed = 0
  if (base) {
    const targets: string[] = []
    for (let host = 1; host <= limit && !options.signal?.aborted; host++) {
      const ip = `${base[0]}.${base[1]}.${base[2]}.${host}`
      if (!ownIps.has(ip)) targets.push(ip)
    }

    const batchSize = 32
    for (let i = 0; i < targets.length; i += batchSize) {
      if (options.signal?.aborted) break
      const batch = targets.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(async (ip) => {
          try {
            await run('ping', ['-n', '1', '-w', '120', ip], { windowsHide: true, timeout: 4000 })
            return ip
          } catch {
            return null
          }
        }),
      )
      for (const ip of results) {
        probed++
        if (!ip) continue
        const existing = found.get(ip)
        if (existing) existing.source = 'ping'
        else found.set(ip, { ip, mac: null, vendor: null, hostname: null, source: 'ping' })
      }
      options.onProgress?.(Math.min(probed, targets.length), targets.length)
    }

    // nach dem Ping ist die ARP-Tabelle gefÃ¼llt: MAC und Hersteller nachziehen
    if (!options.signal?.aborted) {
      await new Promise((r) => setTimeout(r, 400))
      const after = await readArpTable()
      for (const row of after) {
        if (!row.ip || !isInSubnet(row.ip, prefix)) continue
        const device = found.get(row.ip)
        const mac = row.mac && row.mac !== '00:00:00:00:00:00' ? row.mac : null
        if (!device || !mac || device.mac) continue
        device.mac = mac
        device.vendor = vendorFromMac(mac)
        if (row.state === 'Unreachable') device.source = 'ping'
      }
    }
  }

  const devices = [...found.values()].sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }))
  return {
    startedAt,
    ms: Date.now() - startedAt,
    subnet: info ? info.subnet : null,
    interfaceName: info?.interfaceName ?? null,
    probed,
    devices,
    note: base
      ? null
      : 'Kein IPv4-Netz gefunden â€“ ein Ping-Sweep ist nicht mÃ¶glich.',
  }
}
