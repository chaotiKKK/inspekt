import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const exe = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
const PORT = Number(process.env.INSPEKT_CDP_PORT ?? 9337)

if (!fs.existsSync(exe)) {
  console.error(`binary fehlt: ${exe}`)
  process.exit(1)
}

interface Target {
  type: string
  url: string
  title: string
  webSocketDebuggerUrl?: string
}

const args = process.argv[2] ? [] : ['.']
args.push(`--remote-debugging-port=${PORT}`, '--no-first-run')

const child = spawn(exe, args, {
  cwd: root,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr?.setEncoding('utf8')
child.stderr?.on('data', (c: string) => {
  stderr += c
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let cleaning = false
function cleanup(): void {
  if (cleaning) return
  cleaning = true
  try {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  } catch {
    try {
      child.kill()
    } catch {
      /* already gone */
    }
  }
}

function fail(message: string): never {
  console.error(message)
  if (stderr.trim()) console.error('--- electron stderr ---\n' + stderr.trim().slice(0, 4000))
  cleanup()
  process.exit(1)
}

async function targets(): Promise<Target[]> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
    return (await res.json()) as Target[]
  } catch {
    return []
  }
}

let target: Target | null = null
for (let i = 0; i < 240; i++) {
  const list = await targets()
  target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl) ?? null
  if (target?.webSocketDebuggerUrl) break
  if (child.exitCode !== null) break
  await sleep(500)
}
if (!target?.webSocketDebuggerUrl) {
  await sleep(500)
  fail(
    `Kein Renderer-Target über CDP erreichbar (exit=${String(child.exitCode)}, alive=${!child.killed}).` +
      (stderr.trim() ? `\n${stderr.trim().slice(0, 2000)}` : ''),
  )
}

// ---- minimal CDP client ---------------------------------------------------
let nextId = 1
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
const consoleLines: string[] = []

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise<void>((resolve, reject) => {
  ws.addEventListener('open', () => resolve(), { once: true })
  ws.addEventListener('error', () => reject(new Error('CDP-WebSocket fehlgeschlagen')), { once: true })
})

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(String(event.data)) as { id?: number; method?: string; params?: unknown; result?: unknown }
  if (msg.id !== undefined && pending.has(msg.id)) {
    const entry = pending.get(msg.id)!
    pending.delete(msg.id)
    entry.resolve(msg.result ?? msg.params)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const p = msg.params as { type: string; args: { value?: unknown; description?: string }[] }
    const text = p.args.map((a) => a.value ?? a.description ?? '').join(' ')
    consoleLines.push(`[console.${p.type}] ${text}`)
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const p = msg.params as { exceptionDetails: { text?: string; exception?: { description?: string } } }
    consoleLines.push(`[exception] ${p.exceptionDetails.text ?? ''} ${p.exceptionDetails.exception?.description ?? ''}`)
  }
  if (msg.method === 'Log.entryAdded') {
    const p = msg.params as { entry: { level: string; text: string } }
    if (p.entry.level === 'error' || p.entry.level === 'warning') consoleLines.push(`[${p.entry.level}] ${p.entry.text}`)
  }
})

function call<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 15000): Promise<T> {
  const id = nextId++
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: (v) => resolve(v as T), reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`CDP timeout: ${method}`))
      }
    }, timeoutMs)
  })
}

await call('Runtime.enable')
await call('Log.enable')

// ---- wait for the first collection to finish --------------------------------
await sleep(16000)

const probe = await call<{ result: { value: unknown } }>('Runtime.evaluate', {
  expression: `JSON.stringify({
    inspekt: typeof window.inspekt,
    title: document.title,
    h1: document.querySelector('h1')?.textContent ?? null,
    navCount: document.querySelectorAll('aside nav button').length,
    tiles: [...document.querySelectorAll('.panel .eyebrow')].slice(0, 6).map(e => e.textContent),
    bodyChars: document.body.innerText.length,
    hasSlotMap: document.body.innerText.includes('freier Platz') || document.body.innerText.includes('DIMM'),
    sample: document.body.innerText.slice(0, 700)
  })`,
  returnByValue: true,
})

const info = JSON.parse(String((probe.result as { value: string }).value ?? '{}')) as Record<string, unknown>

console.log('=== Renderer ===')
console.log(`typeof window.inspekt : ${String(info.inspekt)}`)
console.log(`document.title        : ${String(info.title)}`)
console.log(`h1                    : ${String(info.h1)}`)
console.log(`nav buttons           : ${String(info.navCount)}`)
console.log(`body characters       : ${String(info.bodyChars)}`)
console.log(`slot map present      : ${String(info.hasSlotMap)}`)
console.log(`eyebrows              : ${(info.tiles as string[] | undefined)?.join(' | ')}`)
console.log('\n=== body (Auszug) ===')
console.log(String(info.sample))

// ---- walk through every page -----------------------------------------------
console.log('[schritt] Seitenrundgang …')
const walk = await call<{ result?: { value?: unknown } }>('Runtime.evaluate', {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => {
    const out = [];
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const btns = () => [...document.querySelectorAll('aside nav button')];
    const initial = btns().length;
    for (let i = 1; i < initial; i++) {
      const list = btns();
      if (!list[i]) break;
      list[i].click();
      await sleep(700);
      const h1 = document.querySelector('h1')?.textContent ?? '?';
      const panels = document.querySelectorAll('.panel').length;
      out.push(\`\${i}. \${h1} | panels=\${panels} | chars=\${document.body.innerText.length}\`);
    }
    btns()[0]?.click();
    await sleep(400);
    const themeBtn = [...document.querySelectorAll('header button')].pop();
    themeBtn?.click();
    await sleep(300);
    const light = document.documentElement.classList.contains('light');
    themeBtn?.click();
    await sleep(300);
    const backToDark = !document.documentElement.classList.contains('light');
    out.push(\`theme: light=\${light} revert=\${backToDark}\`);
    return out.join('\\n');
  })()`,
  },
  90000,
)

const walkValue = String((walk.result as { value?: string } | undefined)?.value ?? '(leer)')
console.log('\n=== Seitenrundgang ===')
console.log(walkValue)

// ---- telemetry stream -------------------------------------------------------
console.log('[schritt] Telemetrie …')
const telemetry = await call<{ result?: { value?: unknown } }>('Runtime.evaluate', {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const ticks = [];
    const errors = [];
    const offA = window.inspekt.onTelemetry((t) => ticks.push(t));
    const offB = window.inspekt.onTelemetryError((m) => errors.push(m));
    let started = null;
    try { started = await window.inspekt.telemetryStart(); } catch (e) { errors.push('start: ' + e); }
    await sleep(6000);
    try { await window.inspekt.telemetryStop(); } catch (e) { errors.push('stop: ' + e); }
    offA(); offB();
    const first = ticks[0] ?? null;
    return JSON.stringify({
      started,
      ticks: ticks.length,
      errors,
      sample: first
        ? {
            cpuLoadPercent: first.cpuLoadPercent,
            memoryFreeMB: first.memoryFreeMB,
            memoryTotalMB: first.memoryTotalMB,
            gpuTempC: first.gpuTempC,
            diskPercent: first.diskPercent,
            rxBps: first.rxBps
          }
        : null
    });
  })()`,
  },
  90000,
)

const telemetryValue = String((telemetry.result as { value?: string } | undefined)?.value ?? '{}')
console.log('\n=== Telemetrie ===')
console.log(telemetryValue)

// ---- benchmark on the Rechenkraft page ---------------------------------------
console.log('[schritt] Benchmark über die UI …')
const bench = await call<{ result?: { value?: unknown } }>('Runtime.evaluate', {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const btns = [...document.querySelectorAll('aside nav button')];
    const target = btns.find(b => b.textContent.includes('Rechenkraft'));
    if (!target) return JSON.stringify({ ok: false, reason: 'Seite nicht in der Navigation' });
    target.click();
    await sleep(600);
    const run = document.querySelector('[data-bench="run"]');
    if (!run) return JSON.stringify({ ok: false, reason: 'Startknopf fehlt' });
    const started = Date.now();
    run.click();
    await sleep(350);
    const running = !!document.querySelector('[data-bench="progress"]');
    while (!document.querySelector('[data-bench="result"]') && Date.now() - started < 45000) {
      await sleep(400);
    }
    const text = document.body.innerText.toLowerCase();
    const score = text.match(/inspekt-score\\s+([0-9.,]+)/);
    const unit4090 = (text.match(/nvidia rtx 4090\\s+([0-9.,]+\\s*[kmgt]?flops)/) || [])[1] ?? null;
    let history = 0;
    try { history = (await window.inspekt.benchHistory()).length; } catch (e) { history = -1; }
    const latencyNs = (text.match(/(\\d+[,.]\\d)\\s*ns/) || [])[1] ?? null;
    return JSON.stringify({
      ok: !!document.querySelector('[data-bench="result"]'),
      running,
      score: score ? score[1] : null,
      unit4090,
      zeroMs: /\\b0 ms\\b/.test(text),
      history,
      latencyNs,
      latencyPanel: text.includes('latenz') && text.includes('cache'),
      sources: document.querySelectorAll('[data-bench="page"] button').length,
      svgs: document.querySelectorAll('[data-bench="page"] svg').length,
      bars: document.querySelectorAll('[data-bench="page"] .h-4').length,
      ms: Date.now() - started,
      compare: text.includes('rechner im vergleich'),
      time: text.includes('zeitvergleich'),
      historical: text.includes('cray-1'),
      note: text.includes('score') && text.includes('baseline')
    });
  })()`,
  },
  90000,
)

const benchValue = String((bench.result as { value?: string } | undefined)?.value ?? '{}')
console.log('\n=== Benchmark ===')
console.log(benchValue)

// ---- Screenshots der fertigen Rechenkraft-Seite ------------------------------
async function shot(relative: string): Promise<void> {
  try {
    const res = await call<{ data?: string }>('Page.captureScreenshot', { format: 'png' }, 60000)
    if (res.data) {
      const file = path.join(root, relative)
      fs.writeFileSync(file, Buffer.from(res.data, 'base64'))
      console.log(`Screenshot: ${file}`)
    }
  } catch (err) {
    console.log(`Screenshot übersprungen (${relative}): ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function scrollTo(marker: string): Promise<void> {
  await call(
    'Runtime.evaluate',
    {
      expression: `(() => {
        const main = document.querySelector('main');
        const panel = [...document.querySelectorAll('.panel')].find(p => p.textContent.includes(${JSON.stringify(marker)}));
        if (main && panel) main.scrollTop = panel.getBoundingClientRect().top + main.scrollTop - 70;
      })()`,
    },
    30000,
  )
  await sleep(700)
}

try {
  await call('Page.enable')
  await shot('build/smoke-rechenkraft.png')
  await scrollTo('Rechner im Vergleich')
  await shot('build/smoke-rechenkraft-diagramme.png')
  await scrollTo('Zeitvergleich')
  await shot('build/smoke-rechenkraft-zeit.png')

  await call(
    'Runtime.evaluate',
    {
      expression: `(() => {
        const btn = [...document.querySelectorAll('aside nav button')].find(b => b.textContent.includes('Sensoren'));
        btn?.click();
      })()`,
    },
    30000,
  )
  await sleep(900)
  await scrollTo('alle Kennzahlen im Bild')
  await shot('build/smoke-verlauf.png')
} catch (err) {
  console.log(`Screenshot übersprungen: ${err instanceof Error ? err.message : String(err)}`)
}

const errors = consoleLines.filter((l) => l.startsWith('[exception]') || l.startsWith('[error]') || l.startsWith('error'))
console.log('\n=== Konsole ===')
console.log(errors.length ? errors.join('\n') : 'keine Fehler')

// ---- gate --------------------------------------------------------------------
interface TelemetryReport {
  started?: boolean
  ticks?: number
  errors?: string[]
  sample?: Record<string, number | null> | null
}
let tel: TelemetryReport = {}
try {
  tel = JSON.parse(telemetryValue) as TelemetryReport
} catch {
  tel = {}
}

const pages = walkValue.split('\n').filter((l) => /^\d+\. /.test(l))
const themeLine = walkValue.split('\n').find((l) => l.startsWith('theme:')) ?? ''

interface BenchReport {
  ok?: boolean
  running?: boolean
  score?: string | null
  unit4090?: string | null
  zeroMs?: boolean
  history?: number
  latencyNs?: string | null
  latencyPanel?: boolean
  sources?: number
  svgs?: number
  bars?: number
  ms?: number
  compare?: boolean
  time?: boolean
  historical?: boolean
  note?: boolean
  reason?: string
}
let benchReport: BenchReport = {}
try {
  benchReport = JSON.parse(benchValue) as BenchReport
} catch {
  benchReport = {}
}

const checks: [string, boolean, string | null][] = [
  ['preload-Bridge', info.inspekt === 'object', String(info.inspekt)],
  ['13 Navigationspunkte', Number(info.navCount) === 13, String(info.navCount)],
  ['Startseite gerendert', Number(info.bodyChars) > 1000, `${String(info.bodyChars)} Zeichen`],
  ['SlotMap vorhanden', info.hasSlotMap === true, null],
  ['alle Seiten rendern', pages.length >= 12, `${pages.length} Seiten (Rundgang ohne Startseite)`],
  ['Thema umschaltbar', themeLine === 'theme: light=true revert=true', themeLine],
  ['Benchmark startet', benchReport.running === true, `running=${String(benchReport.running)}`],
  ['Benchmark liefert Ergebnis', benchReport.ok === true, `Score=${String(benchReport.score)} nach ${String(benchReport.ms)} ms`],
  ['Score positiv', Number(benchReport.score) > 0, String(benchReport.score)],
  ['Vergleichsdiagramme', (benchReport.svgs ?? 0) >= 1, `${String(benchReport.svgs)} SVG`],
  ['Einheiten im Balkendiagramm', /tflops/.test(benchReport.unit4090 ?? ''), `RTX 4090 = ${String(benchReport.unit4090)}`],
  ['Sub-Millisekunden lesbar', benchReport.zeroMs === false, benchReport.zeroMs ? 'zeigt noch "0 ms"' : 'ms/µs-Format aktiv'],
  ['Latenz-Sweep sichtbar', benchReport.latencyPanel === true && benchReport.latencyNs !== null, `RAM-Latenz ${String(benchReport.latencyNs)} ns`],
  ['Verlauf gespeichert', (benchReport.history ?? 0) >= 1, `${String(benchReport.history)} Läufe in der Historie`],
  ['Quellen verlinkbar', (benchReport.sources ?? 0) >= 40, `${String(benchReport.sources)} Quellen-Buttons`],
  ['Balken gerendert', (benchReport.bars ?? 0) >= 8, `${String(benchReport.bars)} Balken`],
  ['Referenzen enthalten', benchReport.historical === true && benchReport.compare === true && benchReport.time === true, null],
  ['Score-Formel erklärt', benchReport.note === true, null],
  ['Telemetrie startet', tel.started === true, `started=${String(tel.started)}`],
  ['Telemetrie-Ticks', (tel.ticks ?? 0) >= 1, `${String(tel.ticks)} Ticks`],
  ['Telemetrie ohne Fehler', (tel.errors ?? []).length === 0, (tel.errors ?? []).join(', ') || 'clean'],
  ['GPU-Werte aus nvidia-smi', typeof tel.sample?.gpuTempC === 'number', `gpuTempC=${String(tel.sample?.gpuTempC)}`],
  ['keine Konsolenfehler', errors.length === 0, `${errors.length} Fehler`],
]

console.log('\n=== Prüfung ===')
let failed = 0
for (const [label, pass, detail] of checks) {
  if (pass) {
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    failed++
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

try {
  ws.close()
} catch {
  /* ignore */
}
cleanup()
await sleep(500)

console.log(`\n${failed} failure(s)`)
process.exit(failed > 0 ? 1 : 0)
