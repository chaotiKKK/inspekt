import fs from 'node:fs'
import path from 'node:path'
import { collectRaw } from '../node/collect.ts'

const root = path.resolve(import.meta.dirname, '..')
const scriptPath = path.join(root, 'electron', 'collector', 'collect.ps1')
const outPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'fixtures', 'snapshot.json')

const started = Date.now()
const { snapshot, meta } = await collectRaw({ scriptPath })
const elapsed = Date.now() - started

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

const failed = Object.entries(snapshot.sections)
  .filter(([, s]) => !s.ok)
  .map(([name, s]) => `${name}: ${s.error ?? 'unbekannt'}`)

console.log(`snapshot written: ${path.relative(root, outPath)}`)
console.log(`  collectedAt : ${meta.collectedAt}`)
console.log(`  elevated    : ${meta.elevated}`)
console.log(`  psVersion   : ${meta.psVersion}`)
console.log(`  ps time     : ${meta.totalMs} ms (wall ${elapsed} ms)`)
console.log(`  sections    : ${Object.keys(snapshot.sections).length}`)
if (failed.length) {
  console.log('  failed sections:')
  for (const f of failed) console.log(`    - ${f}`)
}
