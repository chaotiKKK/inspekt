import fs from 'node:fs'
import path from 'node:path'
import { collectRaw } from '../node/collect.ts'
import { redactSnapshot } from '../node/redact.ts'

const root = path.resolve(import.meta.dirname, '..')
const scriptPath = path.join(root, 'electron', 'collector', 'collect.ps1')

const args = process.argv.slice(2)
const redact = args.includes('--redact')
const target = args.find((a) => !a.startsWith('--'))
const outPath = path.resolve(target ?? path.join(root, 'fixtures', redact ? 'snapshot.redacted.json' : 'snapshot.json'))

const started = Date.now()
const { snapshot, meta } = await collectRaw({ scriptPath })
const elapsed = Date.now() - started

let output = snapshot
let redacted = 0
let redactedFields: string[] = []
if (redact) {
  const result = redactSnapshot(snapshot)
  output = result.snapshot
  redacted = result.count
  redactedFields = result.fields
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

const failed = Object.entries(output.sections)
  .filter(([, s]) => !s.ok)
  .map(([name, s]) => `${name}: ${s.error ?? 'unbekannt'}`)

console.log(`snapshot written: ${path.relative(root, outPath)}`)
console.log(`  collectedAt : ${meta.collectedAt}`)
console.log(`  elevated    : ${meta.elevated}`)
console.log(`  psVersion   : ${meta.psVersion}`)
console.log(`  ps time     : ${meta.totalMs} ms (wall ${elapsed} ms)`)
console.log(`  sections    : ${Object.keys(output.sections).length}`)
if (redact) {
  console.log(`  anonymized  : ${redacted} Werte in ${redactedFields.length} Feldern`)
  for (const field of redactedFields.slice(0, 12)) console.log(`    - ${field}`)
  if (redactedFields.length > 12) console.log(`    … ${redactedFields.length - 12} weitere`)
}
if (failed.length) {
  console.log('  failed sections:')
  for (const f of failed) console.log(`    - ${f}`)
}