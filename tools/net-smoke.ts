import { activeSubnet, vendorFromMac } from '../node/net-scan.ts'

let failures = 0

function ok(label: string, condition: boolean, detail: string = ''): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    failures++
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

console.log('net-smoke: Netz-Helfer (ohne Netzwerkverkehr)\n')

console.log('Subnetzermittlung')
const subnet = await activeSubnet()
if (subnet) {
  ok('subnetz gefunden', /^\d{1,3}\.\d{1,3}\.\d{1,3}\.0\/24$/.test(subnet.subnet), `${subnet.subnet} über ${subnet.interfaceName}`)
} else {
  ok('kein subnetz - nur ipv6 oder offline', true, 'zulässig, Scan meldet das in der Oberfläche')
}

console.log('\nherstellerzuordnung')
ok('bekannter oui wird erkannt', vendorFromMac('00:1B:63:11:22:33') === 'Apple', String(vendorFromMac('00:1B:63:11:22:33')))
ok('bindestriche werden akzeptiert', vendorFromMac('00-1B-63-11-22-33') === 'Apple')
ok('grossschreibung egal', vendorFromMac('00:1b:63:aa:bb:cc') === 'Apple')
ok('unbekannter oui bleibt leer', vendorFromMac('9A:29:06:C2:92:6D') === null, String(vendorFromMac('9A:29:06:C2:92:6D')))
ok('beschreibung schlägt oui', vendorFromMac('00:1B:63:11:22:33', 'Intel(R) Wi-Fi 6E AX211') === 'Intel', String(vendorFromMac('00:1B:63:11:22:33', 'Intel(R) Wi-Fi 6E AX211')))
ok('leere mac bleibt leer', vendorFromMac(null) === null)
ok('zu kurze mac bleibt leer', vendorFromMac('00:1B') === null)
ok('unsinn bleibt leer', vendorFromMac('keine-adresse') === null)
ok('nvidia wird erkannt', vendorFromMac(null, 'NVIDIA GeForce RTX 5070 Laptop GPU') === 'NVIDIA', String(vendorFromMac(null, 'NVIDIA GeForce RTX 5070 Laptop GPU')))

console.log(`\n${failures} failure(s)`)
process.exit(failures > 0 ? 1 : 0)