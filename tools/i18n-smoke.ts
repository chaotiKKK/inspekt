import { getLocale, registriere, setLocale, t, translateStats, uebersetzt, type Locale } from '../src/lib/i18n.ts'
import {
  batteryStatus,
  chassisType,
  deviceClass,
  errorCorrection,
  formFactor,
  healthLabel,
  memoryType,
  monitorOutputLabel,
  pcSystemType,
} from '../src/lib/labels.ts'
import { navLabel, NAV } from '../src/lib/nav.ts'

let failures = 0

function ok(label: string, condition: boolean, detail: string = ''): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    failures++
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

console.log('i18n-smoke: Sprachumschaltung\n')

ok('startsprache ist deutsch', getLocale() === 'de', getLocale())

console.log('\ndeutsche variante (vorgabe)')
ok('speichertyp', memoryType(26) === 'DDR4', String(memoryType(26)))
ok('formfaktor', formFactor(12) === 'SO-DIMM', String(formFactor(12)))
ok('ecc', errorCorrection(3) === 'Keine', String(errorCorrection(3)))
ok('gehaeuse', chassisType(10) === 'Notebook', String(chassisType(10)))
ok('systemtyp', pcSystemType(2) === 'Mobil', String(pcSystemType(2)))
ok('akku', batteryStatus(6) === 'Wird geladen', String(batteryStatus(6)))
ok('monitor intern', monitorOutputLabel(0x80000000) === 'Intern (eDP)', String(monitorOutputLabel(0x80000000)))
ok('monitor unbekannt', monitorOutputLabel(99) === 'Code 99', String(monitorOutputLabel(99)))
ok('geraeteklasse', deviceClass('USBDevice') === 'USB-Gerät', deviceClass('USBDevice'))
ok('geraeteklasse unbekannt bleibt code', deviceClass('XyzCustom') === 'XyzCustom')
ok('geraet ohne klasse', deviceClass(null) === 'Ohne Klasse', deviceClass(null))
ok('zustand', healthLabel('Warning') === 'Warnung', String(healthLabel('Warning')))
ok('zustand unbekannt bleibt', healthLabel('Weird') === 'Weird')
ok('navigation', navLabel(NAV[0]) === 'Übersicht', navLabel(NAV[0]))

setLocale('en')
console.log('\nenglische variante')
ok('sprache gewechselt', getLocale() === 'en', getLocale())
ok('sprichertyp', memoryType(26) === 'DDR4', String(memoryType(26)))
ok('formfaktor', formFactor(12) === 'SO-DIMM', String(formFactor(12)))
ok('ecc', errorCorrection(3) === 'None', String(errorCorrection(3)))
ok('gehaeuse', chassisType(10) === 'Notebook', String(chassisType(10)))
ok('akku', batteryStatus(6) === 'Charging', String(batteryStatus(6)))
ok('monitor intern', monitorOutputLabel(0x80000000) === 'Internal (eDP)', String(monitorOutputLabel(0x80000000)))
ok('geraeteklasse', deviceClass('USBDevice') === 'USB device', deviceClass('USBDevice'))
ok('zustand', healthLabel('Warning') === 'Warning', String(healthLabel('Warning')))
ok('navigation übersetzt', navLabel(NAV[0]) === 'Overview', navLabel(NAV[0]))
ok(
  'alle 13 bereiche übersetzt',
  NAV.every((item) => uebersetzt(item.labelKey, 'en')),
  NAV.filter((i) => !uebersetzt(i.labelKey, 'en')).map((i) => i.id).join(',') || 'keine',
)
ok('navigation vollständig', navLabel(NAV[5]) === 'Performance', navLabel(NAV[5]))

console.log('\nfallback-verhalten')
registriere({ en: { 'test.nur.deutsch': 'Nur auf Deutsch' } })
ok('fehlender schluessel nutzt fallback', t('test.gibtsnicht', 'Deutscher Text') === 'Deutscher Text')
ok('registrierter schluessel', t('test.nur.deutsch', 'anderer Text') === 'Nur auf Deutsch')
ok('platzhalter', t('test.muster', 'Wert {name}', { name: 'X' }) === 'Wert X', t('test.muster', 'Wert {name}', { name: 'X' }))
ok('unbekannter schluessel zeigt sich selbst', t('test.gibtsnicht2') === 'test.gibtsnicht2')

const stats = translateStats()
ok('englische schluessel vorhanden', stats.en > 120, `${stats.en} Schlüssel`)
ok('deutsche schluessel vorhanden', stats.de > 120, `${stats.de} Schlüssel`)

setLocale('de')
ok('zurueck auf deutsch', memoryType(26) === 'DDR4' && navLabel(NAV[0]) === 'Übersicht')

const sprachen: Locale[] = ['de', 'en']
ok('beide sprachen abgedeckt', sprachen.length === 2 && sprachen.every((s) => translateStats()[s] > 0))

console.log(`\n${failures} failure(s)`)
process.exit(failures > 0 ? 1 : 0)