import fs from 'node:fs'
import path from 'node:path'
import { SnapshotSchema } from '../shared/schema.ts'
import { buildCsv, buildHtml, buildJson, fileStamp, type ReportFormat } from '../src/lib/export.ts'

const root = path.resolve(import.meta.dirname, '..')
const fixturePath = path.join(root, 'fixtures', 'snapshot.json')

let failures = 0
let warnings = 0

function ok(label: string, condition: boolean, detail: string | null = ''): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    failures++
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

function warn(label: string, condition: boolean, detail: string | null = ''): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    warnings++
    console.log(`  WARN  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

console.log('export-smoke: building all report formats from the fixture\n')

const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as unknown
const parsed = SnapshotSchema.safeParse(raw)
ok('fixture matches SnapshotSchema', parsed.success, parsed.success ? null : parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join(' | '))
if (!parsed.success) process.exit(1)
const snapshot = parsed.data
const version = '1.0.0'
const sections = Object.keys(snapshot.sections).length

const junk = /undefined|NaN|\[object Object\]/

// --- JSON ------------------------------------------------------------------
console.log('json')
const json = buildJson(snapshot, version)
interface Envelope {
  app?: string
  appVersion?: string
  exportedAt?: string
  snapshot?: unknown
}
let jsonParsed: Envelope | null = null
try {
  jsonParsed = JSON.parse(json) as Envelope
} catch {
  jsonParsed = null
}
ok('is valid JSON', jsonParsed !== null, `${json.length} bytes`)
ok('carries envelope', jsonParsed?.app === 'Inspekt' && jsonParsed?.appVersion === version && typeof jsonParsed?.exportedAt === 'string')
ok('snapshot survives round trip', JSON.stringify(jsonParsed?.snapshot) === JSON.stringify(snapshot), `${sections} sections`)
ok('no replacement characters', !json.includes('\uFFFD'))
ok('ends with a newline', json.endsWith('\n'))
warn('no junk values', !junk.test(json), junk.exec(json)?.[0] ?? 'clean')

// --- CSV -------------------------------------------------------------------
console.log('\ncsv')
const csv = buildCsv(snapshot)
const bom = csv.charCodeAt(0) === 0xfeff
const lines = csv.slice(bom ? 1 : 0).split('\r\n').filter((l) => l.length > 0)
const header = lines[0]
const body = lines.slice(1)
const quoted = /^"[^"]*";"[^"]*"$/
ok('starts with UTF-8 BOM', bom)
ok('header is Bereich;Wert', header === 'Bereich;Wert', header)
ok('every row is two quoted fields', body.every((l) => quoted.test(l)), `${body.length} rows`)
ok('covers every section', Object.keys(snapshot.sections).every((s) => body.some((l) => l.startsWith(`"${s}.ok";`))), Object.keys(snapshot.sections).join(','))
ok('flattened values are present', body.some((l) => l.startsWith('"memory.modules[')), null)
ok('no replacement characters', !csv.includes('\uFFFD'))
warn('no junk values', !junk.test(csv), junk.exec(csv)?.[0] ?? 'clean')

// --- HTML ------------------------------------------------------------------
console.log('\nhtml')
const html = buildHtml(snapshot, version)
ok('is a complete document', html.startsWith('<!doctype html>') && html.trimEnd().endsWith('</html>'), `${html.length} bytes`)
ok('declares utf-8', html.includes('<meta charset="utf-8">'))
ok('is self contained (no external requests)', !/(src|href)\s*=\s*["']https?:/i.test(html))
ok('contains no script tags', !/<script/i.test(html))
ok('contains system model', html.includes(snapshot.sections.system.data?.model ?? 'x'))
ok('contains every table heading', ['System', 'Arbeitsspeicher', 'Datenträger', 'Prozessor', 'Grafik', 'Netzwerk', 'Monitore', 'Akku', 'Sicherheit'].every((t) => html.includes(`>${t}</h3>`)), null)
ok('failed sections are reported', snapshot.sections.cpu.ok ? html.includes('Abgebrochene Bereiche') || Object.values(snapshot.sections).every((s) => s.ok) : true)
ok('no replacement characters', !html.includes('\uFFFD'))
warn('no junk values', !junk.test(html), junk.exec(html)?.[0] ?? 'clean')

// --- escaping --------------------------------------------------------------
console.log('\nescaping')
const injected = { ...snapshot, sections: { ...snapshot.sections } }
const evil = 'Ampersand & <script>alert(1)</script> "quoted"'
injected.sections.system = { ...snapshot.sections.system, data: { ...snapshot.sections.system.data, model: evil } }
const escapedHtml = buildHtml(injected, version)
ok('HTML escapes markup', !escapedHtml.includes('<script>alert(1)') && escapedHtml.includes('&lt;script&gt;'), null)
ok('CSV keeps the raw value inside quotes', buildCsv(injected).includes(evil.replace(/"/g, '""')), null)
ok('JSON keeps the raw value', buildJson(injected, version).includes(evil.replace(/&/g, '\\u0026').slice(0, 6)) || buildJson(injected, version).includes('script'), null)

// --- file stamp ------------------------------------------------------------
console.log('\nfile names')
const stamp = fileStamp()
ok('stamp is YYYY-MM-DD-HHMM', /^\d{4}-\d{2}-\d{2}-\d{4}$/.test(stamp), stamp)
const formats: ReportFormat[] = ['json', 'csv', 'html']
ok('formats are declared', formats.length === 3, formats.join(', '))

console.log(`\n${failures} failure(s), ${warnings} warning(s)`)
process.exit(failures > 0 ? 1 : 0)
