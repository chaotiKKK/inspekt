import { useState } from 'react'
import { FileDown, FileJson, FileSpreadsheet, FileText, Moon, Sun } from 'lucide-react'
import { Badge, KV, Notice, Panel, StatTile } from '../components/ui.tsx'
import { bytes, dateTime, duration, num } from '../lib/format.ts'
import { fileStamp, buildCsv, buildHtml, buildJson, type ReportFormat } from '../lib/export.ts'
import { useAppInfo } from '../lib/hooks.ts'
import type { PageProps } from './PageProps.ts'

export function ReportPage({ snapshot, report, elevated, settings, patchSettings }: PageProps): React.ReactNode {
  const info = useAppInfo()
  const [message, setMessage] = useState<{ tone: 'good' | 'bad' | 'neutral'; text: string } | null>(null)
  const [busy, setBusy] = useState<ReportFormat | null>(null)

  const sys = snapshot?.sections.system.data ?? null

  async function exportAs(format: ReportFormat): Promise<void> {
    if (!snapshot || busy) return
    setBusy(format)
    setMessage(null)
    try {
      const version = info?.version ?? '0'
      const content =
        format === 'json' ? buildJson(snapshot, version) : format === 'csv' ? buildCsv(snapshot) : buildHtml(snapshot, version)
      const result = await window.inspekt.export({
        format,
        content,
        defaultName: `Inspekt-Bericht-${fileStamp()}`,
      })
      if (result.canceled) {
        setMessage({ tone: 'neutral', text: 'Speichern abgebrochen.' })
      } else {
        setMessage({ tone: 'good', text: `Gespeichert als ${result.filePath}` })
      }
    } catch (err) {
      setMessage({ tone: 'bad', text: (err as Error).message || 'Export fehlgeschlagen.' })
    } finally {
      setBusy(null)
    }
  }

  const buttons: { format: ReportFormat; label: string; hint: string; Icon: typeof FileJson }[] = [
    { format: 'json', label: 'Als JSON', hint: 'Maschinenlesbar, vollständig, inklusive Rohfelder.', Icon: FileJson },
    { format: 'csv', label: 'Als CSV', hint: 'Semikolon-getrennt mit BOM – öffnet sauber in Excel.', Icon: FileSpreadsheet },
    { format: 'html', label: 'Als HTML', hint: 'Eigenständige Seite, druckbar und per Mail teilbar.', Icon: FileText },
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Datenstand" value={snapshot ? new Date(snapshot.collectedAt).toLocaleTimeString('de-DE') : '—'} hint={snapshot ? dateTime(snapshot.collectedAt) : undefined} />
        <StatTile label="Auslesezeit" value={snapshot?.totalMs ? num(snapshot.totalMs) : '—'} unit="ms" hint="parallel in 5 Gruppen" />
        <StatTile label="Rechte" value={elevated === true ? 'erweitert' : elevated === false ? 'Standard' : '—'} tone={elevated === true ? 'good' : 'warn'} />
        <StatTile label="Bereiche" value={snapshot ? Object.values(snapshot.sections).filter((s) => s.ok).length : '—'} unit={`/ ${snapshot ? Object.keys(snapshot.sections).length : 11}`} hint="erfolgreich gelesen" />
      </div>

      <Panel code="EXP" title="Bericht exportieren">
        <div className="grid gap-4 md:grid-cols-3">
          {buttons.map(({ format, label, hint, Icon }) => (
            <button
              key={format}
              type="button"
              className="group flex flex-col items-start gap-3 rounded-lg border border-line bg-panel2 px-4 py-4 text-left transition-colors hover:border-accent/50 disabled:opacity-50"
              onClick={() => void exportAs(format)}
              disabled={!snapshot || busy !== null}
            >
              <span className="grid h-9 w-9 place-items-center rounded border border-accent/40 bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-mono text-[13px] font-semibold text-fg">
                  {busy === format ? 'Wird geschrieben …' : label}
                </span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{hint}</span>
              </span>
            </button>
          ))}
        </div>
        {message && (
          <div className="mt-4">
            <Notice tone={message.tone === 'good' ? 'good' : message.tone === 'bad' ? 'bad' : 'neutral'} title={message.tone === 'good' ? 'Export abgeschlossen' : message.tone === 'bad' ? 'Export fehlgeschlagen' : 'Export'}>
              <span className="font-mono break-all">{message.text}</span>
            </Notice>
          </div>
        )}
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          Der JSON-Export enthält dieselben Felder, die auch die Oberfläche zeigt – inklusive der Abschnitte, die ohne
          Administratorrechte leer bleiben. So lässt sich später nachvollziehen, was das System wirklich gemeldet hat.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel code="SET" title="Einstellungen">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Design</div>
                <div className="mt-1 text-[13px] text-muted">Standard ist dunkel.</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`btn ${settings.theme === 'dark' ? 'btn-primary' : ''}`}
                  onClick={() => patchSettings({ theme: 'dark' })}
                >
                  <Moon size={13} aria-hidden="true" /> Dunkel
                </button>
                <button
                  type="button"
                  className={`btn ${settings.theme === 'light' ? 'btn-primary' : ''}`}
                  onClick={() => patchSettings({ theme: 'light' })}
                >
                  <Sun size={13} aria-hidden="true" /> Hell
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <div>
                <div className="eyebrow">Live-Messung</div>
                <div className="mt-1 max-w-[46ch] text-[13px] text-muted">
                  Hält einen PowerShell-Prozess offen, damit CPU, RAM, Datenträger, Netzwerk und GPU in Echtzeit mitlaufen.
                </div>
              </div>
              <button
                type="button"
                className={`btn ${settings.telemetry ? 'btn-primary' : ''}`}
                onClick={() => patchSettings({ telemetry: !settings.telemetry })}
              >
                {settings.telemetry ? 'An' : 'Aus'}
              </button>
            </div>

            <div className="border-t border-line pt-4">
              <div className="eyebrow">Anschlüsse selbst zählen</div>
              <div className="mt-1 max-w-[54ch] text-[13px] text-muted">
                Windows meldet keine Anschlusszahl. Die Schätzung gilt bis du die tatsächlichen Werte einträgst.
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-4">
                {(['m2', 'sata'] as const).map((key) => (
                  <label key={key} className="block">
                    <span className="eyebrow">{key === 'm2' ? 'M.2-Anschlüsse' : 'SATA-Anschlüsse'}</span>
                    <input
                      type="number"
                      min={0}
                      max={16}
                      value={settings.override[key] ?? ''}
                      placeholder="Schätzung"
                      onChange={(e) =>
                        patchSettings({ override: { ...settings.override, [key]: e.target.value === '' ? null : Number(e.target.value) } })
                      }
                      className="mt-1.5 block w-32 rounded border border-line2 bg-panel2 px-2.5 py-1.5 font-mono text-[13px] text-fg"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  className="btn"
                  onClick={() => patchSettings({ override: { m2: null, sata: null } })}
                >
                  Zurücksetzen
                </button>
                <Badge tone="accent">aktuell: {report.m2.total}× M.2 · {report.sata.total}× SATA</Badge>
              </div>
            </div>
          </div>
        </Panel>

        <Panel code="INF" title="System & Programm">
          <KV
            items={[
              { label: 'Inspekt', value: `v${info?.version ?? '—'}`, hint: info?.packaged ? 'installierte Version' : 'Entwicklungsmodus' },
              { label: 'Plattform', value: `${info?.platform ?? '—'} · ${info?.arch ?? '—'}` },
              { label: 'Sprache', value: info?.locale ?? '—' },
              { label: 'Datenordner', value: info?.userData ?? '—' },
              { label: 'Sammler', value: snapshot?.psVersion ? `PowerShell ${snapshot.psVersion}` : '—' },
              { label: 'Erhöhte Rechte', value: elevated === true ? 'ja' : 'nein' },
            ]}
          />
          <div className="mt-5 border-t border-line pt-4">
            <div className="eyebrow mb-2">Kennung des Systems</div>
            <div className="space-y-1.5 font-mono text-[12px] text-muted">
              <div className="truncate" title={sys?.uuid ?? ''}>UUID: {sys?.uuid ?? '—'}</div>
              <div className="truncate" title={sys?.serialNumber ?? ''}>SN: {sys?.serialNumber ?? '—'}</div>
              <div>Laufzeit: {duration(sys?.uptimeSec)}</div>
              <div>Arbeitsspeicher: {bytes(sys?.totalMemory)}</div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel code="SEC" title="Datenschutz">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-500">
            <FileDown size={16} aria-hidden="true" />
          </span>
          <p className="max-w-[80ch] text-[13px] leading-relaxed text-muted">
            Inspekt fragt nur das lokale System ab. Es gibt keinen Netzwerkzugriff, keine Telemetrie nach außen und keine
            Konten. Berichte enthalten Seriennummern und MAC-Adressen – vor dem Weitergeben prüfen, was du teilen möchtest.
          </p>
        </div>
      </Panel>
    </div>
  )
}
