import type { Snapshot } from '../../shared/schema.ts'
import { bytes, dateTime } from './format.ts'

export type ReportFormat = 'json' | 'csv' | 'html'

export function fileStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export function buildJson(snapshot: Snapshot, version: string): string {
  return `${JSON.stringify(
    {
      app: 'Inspekt',
      appVersion: version,
      exportedAt: new Date().toISOString(),
      snapshot,
    },
    null,
    2,
  )}\n`
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'ja' : 'nein'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function flatten(value: unknown, prefix: string, out: [string, string][]): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push([prefix, '(leer)'])
      return
    }
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out))
    return
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      out.push([prefix, '(leer)'])
      return
    }
    for (const [key, child] of entries) flatten(child, prefix ? `${prefix}.${key}` : key, out)
    return
  }
  out.push([prefix, stringify(value)])
}

/** Semicolon separated with a UTF-8 BOM so Excel (DE) opens it directly. */
export function buildCsv(snapshot: Snapshot): string {
  const rows: [string, string][] = []
  rows.push(['Kopf.schema', snapshot.schema])
  rows.push(['Kopf.collectedAt', snapshot.collectedAt])
  rows.push(['Kopf.elevated', snapshot.elevated === true ? 'ja' : 'nein'])
  rows.push(['Kopf.psVersion', snapshot.psVersion ?? ''])
  rows.push(['Kopf.totalMs', String(snapshot.totalMs ?? '')])

  for (const [name, section] of Object.entries(snapshot.sections)) {
    rows.push([`${name}.ok`, section.ok ? 'ja' : 'nein'])
    rows.push([`${name}.ms`, section.ms === null || section.ms === undefined ? '' : String(section.ms)])
    rows.push([`${name}.error`, section.error ?? ''])
    flatten(section.data ?? null, name, rows)
  }

  const escape = (v: string): string => `"${v.replace(/"/g, '""')}"`
  const body = rows.map(([path, value]) => `${escape(path)};${escape(value)}`).join('\r\n')
  return `﻿Bereich;Wert\r\n${body}\r\n`
}

function esc(value: unknown): string {
  return stringify(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function table(title: string, headers: string[], rows: string[][]): string {
  if (rows.length === 0) return ''
  return `
  <section>
    <h3>${esc(title)}</h3>
    <table>
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </section>`
}

function kv(pairs: [string, unknown][]): string {
  return `
  <dl class="kv">${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
}

export function buildHtml(snapshot: Snapshot, version: string): string {
  const sys = snapshot.sections.system.data
  const mem = snapshot.sections.memory.data
  const sto = snapshot.sections.storage.data
  const cpu = snapshot.sections.cpu.data
  const gpu = snapshot.sections.gpu.data

  const sections: string[] = []

  sections.push(
    table(
      'System',
      ['Feld', 'Wert'],
      [
        ['Hersteller', sys?.manufacturer ?? ''],
        ['Modell', sys?.model ?? ''],
        ['Betriebssystem', sys?.osCaption ?? ''],
        ['Build', sys?.osBuild ?? ''],
        ['Hostname', sys?.hostname ?? ''],
        ['Seriennummer', sys?.serialNumber ?? ''],
        ['BIOS', `${sys?.biosVendor ?? ''} ${sys?.biosVersion ?? ''}`],
        ['Mainboard', `${sys?.boardMfr ?? ''} ${sys?.boardProduct ?? ''}`],
        ['Firmware', sys?.firmwareType ?? ''],
        ['Arbeitsspeicher gesamt', bytes(sys?.totalMemory)],
        ['Letzter Start', dateTime(sys?.lastBoot)],
      ],
    ),
  )

  sections.push(
    table(
      'Arbeitsspeicher',
      ['Slot', 'Belegung', 'Kapazität', 'Takt', 'Hersteller', 'Teilenummer'],
      (mem?.modules ?? []).map((m, i) => [
        `DIMM_${i + 1}${m.locator ? ` (${m.locator})` : ''}`,
        'belegt',
        bytes(m.capacity),
        `${m.speed ?? '—'} MT/s`,
        m.manufacturer ?? '',
        m.partNumber ?? '',
      ]),
    ),
  )

  const dimmFree = Math.max(0, (mem?.slotsTotal ?? 0) - (mem?.modules?.length ?? 0))
  sections.push(kv([['Freie DIMM-Plätze', dimmFree], ['Belegte DIMM-Plätze', mem?.slotsUsed ?? 0], ['Max. Kapazität', bytes(((mem?.maxCapacityKB ?? 0) * 1024) || null)]]))

  sections.push(
    table(
      'Datenträger',
      ['Modell', 'Bus', 'Größe', 'Partitionen', 'Status', 'Gesundheit'],
      (sto?.disks ?? []).map((d) => [
        d.model ?? '',
        d.busType ?? '',
        bytes(d.size),
        String((d.partitions ?? []).length),
        d.status ?? '',
        d.health ?? '',
      ]),
    ),
  )

  sections.push(
    table(
      'Partitionen',
      ['Datenträger', 'Nr.', 'Laufwerk', 'Dateisystem', 'Größe', 'Frei'],
      (sto?.disks ?? []).flatMap((d) =>
        (d.partitions ?? []).map((p) => [
          d.model ?? '',
          String(p.number ?? ''),
          p.letter ? `${p.letter}:` : '',
          p.fs ?? '',
          bytes(p.size),
          bytes(p.free),
        ]),
      ),
    ),
  )

  sections.push(
    table(
      'Prozessor',
      ['Feld', 'Wert'],
      [
        ['Modell', cpu?.name ?? ''],
        ['Sockel', String(cpu?.items?.[0]?.socket ?? '—')],
        ['Kerne / Threads', `${cpu?.cores ?? '—'} / ${cpu?.threads ?? '—'}`],
        ['Max. Takt', String(cpu?.items?.[0]?.maxClockMHz ?? '—')],
        ['Cache L2 / L3', `${cpu?.items?.[0]?.l2CacheKB ?? '—'} / ${cpu?.items?.[0]?.l3CacheKB ?? '—'} KB`],
      ],
    ),
  )

  sections.push(
    table(
      'Grafik',
      ['Adapter', 'VRAM', 'Treiber', 'Auflösung'],
      (gpu?.adapters ?? []).map((a) => [
        a.name ?? '',
        bytes(a.adapterRam),
        a.driver ?? '',
        a.resolutionH && a.resolutionV ? `${a.resolutionH}×${a.resolutionV}${a.refreshHz ? ` @ ${a.refreshHz} Hz` : ''}` : '',
      ]),
    ),
  )

  if (gpu?.nvidia) {
    sections.push(
      table(
        'NVIDIA (nvidia-smi)',
        ['Feld', 'Wert'],
        [
          ['GPU', gpu.nvidia.name],
          ['Temperatur', gpu.nvidia.tempC === null || gpu.nvidia.tempC === undefined ? '—' : `${gpu.nvidia.tempC} °C`],
          ['Auslastung', gpu.nvidia.utilPct === null || gpu.nvidia.utilPct === undefined ? '—' : `${gpu.nvidia.utilPct} %`],
          ['Speicher', `${gpu.nvidia.memUsedMb ?? '—'} / ${gpu.nvidia.memTotalMb ?? '—'} MiB`],
          ['Leistung', gpu.nvidia.powerW === null || gpu.nvidia.powerW === undefined ? '—' : `${gpu.nvidia.powerW} W`],
          ['Treiber', gpu.nvidia.driverVersion ?? '—'],
        ],
      ),
    )
  }

  sections.push(
    table(
      'Netzwerk',
      ['Name', 'Beschreibung', 'Status', 'Geschwindigkeit', 'MAC', 'IPs'],
      (snapshot.sections.network.data?.adapters ?? []).map((a) => [
        a.name ?? '',
        a.description ?? '',
        a.status ?? '',
        a.linkSpeed ?? '',
        a.mac ?? '',
        (a.addresses ?? []).map((ip) => `${ip.address}${ip.prefix ? `/${ip.prefix}` : ''}`).join(', '),
      ]),
    ),
  )

  sections.push(
    table(
      'Monitore',
      ['Hersteller', 'Produkt', 'Diagonale', 'Baujahr', 'Anschluss'],
      (snapshot.sections.monitors.data?.monitors ?? []).map((m) => [
        m.manufacturer ?? '',
        m.name ?? m.productCode ?? '',
        m.diagonalIn ? `${m.diagonalIn}"` : '',
        m.year ? `${m.year}` : '',
        m.outputTech ? String(m.outputTech) : '',
      ]),
    ),
  )

  sections.push(
    table(
      'Geräteklassen',
      ['Klasse', 'Anzahl'],
      Object.entries(snapshot.sections.devices.data?.byClass ?? {})
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([cls, count]) => [cls, String(count)]),
    ),
  )

  const bat = snapshot.sections.battery.data
  const firstBattery = bat?.batteries?.[0] ?? null
  sections.push(
    table(
      'Akku',
      ['Feld', 'Wert'],
      [
        ['Vorhanden', bat?.present ? 'ja' : 'nein'],
        ['Ladung', firstBattery?.chargePercent === null || firstBattery?.chargePercent === undefined ? '—' : `${firstBattery.chargePercent} %`],
        ['Ladezyklen', String(bat?.cycleCount ?? '—')],
        [
          'Ist-Kapazität',
          firstBattery?.fullCapacity === null || firstBattery?.fullCapacity === undefined
            ? '—'
            : bytes(firstBattery.fullCapacity * 1000),
        ],
        [
          'Nennkapazität',
          firstBattery?.designCapacity === null || firstBattery?.designCapacity === undefined
            ? 'wird nicht gemeldet'
            : bytes(firstBattery.designCapacity * 1000),
        ],
      ],
    ),
  )

  const sec = snapshot.sections.security.data
  sections.push(
    table(
      'Sicherheit',
      ['Feld', 'Wert'],
      [
        ['Secure Boot', sec?.secureBoot === null || sec?.secureBoot === undefined ? '—' : sec.secureBoot ? 'aktiviert' : 'deaktiviert'],
        ['TPM vorhanden', sec?.tpm?.present === null || sec?.tpm?.present === undefined ? '—' : sec.tpm.present ? 'ja' : 'nein'],
        ['Startmodus', sec?.bootMode ?? '—'],
      ],
    ),
  )

  const failed = Object.entries(snapshot.sections)
    .filter(([, s]) => !s.ok)
    .map(([name, s]) => [name, s.error ?? 'unbekannt'] as [string, unknown])

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inspekt – Hardware-Bericht</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 32px 72px; background: #f3f5f8; color: #0e131a;
    font: 14px/1.6 "Segoe UI", system-ui, sans-serif; }
  .wrap { max-width: 980px; margin: 0 auto; }
  header { border-bottom: 2px solid #0e131a; padding-bottom: 18px; margin-bottom: 28px; }
  h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: -0.01em; }
  .meta { font: 12px/1.7 ui-monospace, Consolas, monospace; color: #5b6674; }
  section { background: #fff; border: 1px solid #e2e7ee; border-radius: 8px; padding: 18px 20px; margin-bottom: 16px; }
  h3 { margin: 0 0 12px; font: 600 11px/1 ui-monospace, Consolas, monospace;
    letter-spacing: .16em; text-transform: uppercase; color: #7c3aed; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font: 600 11px/1.4 ui-monospace, Consolas, monospace;
    letter-spacing: .08em; text-transform: uppercase; color: #5b6674;
    border-bottom: 1px solid #d2d9e3; padding: 6px 10px 6px 0; }
  td { padding: 7px 10px 7px 0; border-bottom: 1px solid #eef1f5; vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  .kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 0; }
  .kv > div { border-left: 3px solid #7c3aed; padding-left: 12px; }
  .kv dt { font: 600 10px/1.4 ui-monospace, Consolas, monospace; letter-spacing: .14em;
    text-transform: uppercase; color: #5b6674; }
  .kv dd { margin: 2px 0 0; font: 600 17px/1.3 ui-monospace, Consolas, monospace; }
  .warn { background: #fff7ed; border-color: #fed7aa; color: #9a3412; }
  footer { margin-top: 24px; font: 12px/1.7 ui-monospace, Consolas, monospace; color: #5b6674; }
  @media print { body { background: #fff; padding: 0; } section { break-inside: avoid; } }
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>Inspekt – Hardware-Bericht</h1>
  <div class="meta">
    ${esc(sys?.manufacturer ?? '')} ${esc(sys?.model ?? '')} · ${esc(sys?.serialNumber ?? '')}<br>
    Erstellt ${esc(dateTime(new Date().toISOString()))} · Datenstand ${esc(dateTime(snapshot.collectedAt))} ·
    Inspekt ${esc(version)} · erweiterte Rechte: ${snapshot.elevated === true ? 'ja' : 'nein'}
  </div>
</header>
${failed.length > 0 ? `<section class="warn"><h3>Abgebrochene Bereiche</h3><table><tbody>${failed.map(([n, e]) => `<tr><td>${esc(n)}</td><td>${esc(e)}</td></tr>`).join('')}</tbody></table></section>` : ''}
${sections.join('\n')}
<footer>
  Erzeugt von Inspekt. Alle Angaben stammen aus Windows (WMI/CIM), EDID, nvidia-smi und dem Windows-Protokoll.
  Speicher- und Anschlussbelegung sind Momentaufnahmen.
</footer>
</div>
</body>
</html>
`
}
