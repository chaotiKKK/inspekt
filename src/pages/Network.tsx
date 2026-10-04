import { useEffect, useState } from 'react'
import { MiniBars } from '../components/charts/Mini.tsx'
import { Badge, DataTable, EmptyState, KV, Notice, Panel, StatTile } from '../components/ui.tsx'
import { num, rate } from '../lib/format.ts'
import type { NetScanProgress, NetScanResult } from '../../shared/net.ts'
import type { PageProps } from './PageProps.ts'

export function NetworkPage({ snapshot, telemetry }: PageProps): React.ReactNode {
  const adapters = snapshot?.sections.network.data?.adapters ?? []
  const up = adapters.filter((a) => a.status === 'Up')
  const hardware = adapters.filter((a) => a.hardware !== false)
  const primary = up.find((a) => a.hardware !== false) ?? up[0] ?? null
  const tick = telemetry.tick

  const [scan, setScan] = useState<NetScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<NetScanProgress | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  useEffect(() => {
    const api = window.inspekt
    if (!api?.onNetScanProgress) return undefined
    return api.onNetScanProgress((p) => setProgress(p))
  }, [])

  const startScan = async (): Promise<void> => {
    const api = window.inspekt
    if (!api?.netScan) return
    setScanning(true)
    setScanError(null)
    setProgress(null)
    try {
      setScan(await api.netScan())
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Aktive Verbindungen" value={up.length} unit={`/ ${adapters.length}`} hint={primary?.name ?? 'keine aktive Verbindung'} tone={up.length > 0 ? 'good' : 'warn'} />
        <StatTile label="Physische Adapter" value={hardware.length} hint={`${adapters.length - hardware.length} virtuell`} />
        <StatTile label="Empfang (live)" value={tick?.rxBps !== null && tick?.rxBps !== undefined ? `${(tick.rxBps / 1024).toFixed(1)}` : '—'} unit="kB/s" hint="Gesamtsumme aller Adapter" />
        <StatTile label="Sendung (live)" value={tick?.txBps !== null && tick?.txBps !== undefined ? `${(tick.txBps / 1024).toFixed(1)}` : '—'} unit="kB/s" hint="Gesamtsumme aller Adapter" />
      </div>

      {adapters.length === 0 && <EmptyState title="Keine Netzwerkadapter gefunden" />}

      <Panel code="SPD" title="Verbindungsgeschwindigkeiten">
        <MiniBars
          items={adapters
            .filter((a) => (a.speedBps ?? 0) > 0)
            .map((a, i) => ({
              id: `${a.ifIndex ?? i}`,
              label: a.name ?? `Adapter ${i + 1}`,
              value: (a.speedBps ?? 0) / 1e6,
              display: num((a.speedBps ?? 0) / 1e6, 0),
              hint: `${a.mediaType ?? ''} ${a.linkSpeed ?? ''}`.trim(),
              color: a.status === 'Up' ? undefined : '#64748b',
            }))}
          unitSuffix="Mbit/s"
          empty="Keine Adapter melden eine Verbindungsgeschwindigkeit."
        />
        <p className="mt-3 border-t border-line pt-3 font-mono text-[10.5px] text-faint">
          Graue Balken: Adapter aktuell nicht verbunden · Wert ist der gemeldete Link, nicht die aktuelle Datenrate
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {adapters.map((a, i) => {
          const ips = (a.addresses ?? []).filter((ip) => ip.family === 'IPv4')
          const v6 = (a.addresses ?? []).filter((ip) => ip.family === 'IPv6')
          return (
            <div key={`${a.ifIndex ?? i}`} className="relative overflow-hidden rounded-lg border border-line bg-panel2 px-5 py-5">
              <span
                className={`absolute inset-x-0 top-0 h-[3px] ${a.status === 'Up' ? 'bg-accent' : 'bg-line2'}`}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h3 className="truncate font-mono text-[15px] font-semibold text-fg">{a.name ?? '—'}</h3>
                    <Badge tone={a.status === 'Up' ? 'good' : a.present === false ? 'neutral' : 'warn'}>
                      {a.status ?? '—'}
                    </Badge>
                    {a.virtual && <Badge>virtuell</Badge>}
                    {a.connector && <Badge tone="accent">kabelgebunden</Badge>}
                  </div>
                  <div className="mt-1.5 truncate text-[13px] text-muted">{a.description ?? '—'}</div>
                </div>
                <div className="text-right">
                  <div className="eyebrow">Verbindung</div>
                  <div className="mt-1 font-mono text-[16px] text-fg">{a.linkSpeed ?? '—'}</div>
                  <div className="font-mono text-[11px] text-faint">{a.fullDuplex ? 'vollduplex' : 'halbduplex'}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <div>
                  <div className="eyebrow">IPv4</div>
                  <div className="mt-1.5 space-y-1">
                    {ips.length === 0 && <div className="font-mono text-[12.5px] text-faint">keine Adresse</div>}
                    {ips.map((ip) => (
                      <div key={ip.address} className="font-mono text-[12.5px] text-fg">
                        {ip.address}
                        {ip.prefix !== null && ip.prefix !== undefined ? `/${ip.prefix}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="eyebrow">Gateway & DNS</div>
                  <div className="mt-1.5 space-y-1 font-mono text-[12.5px]">
                    {(a.gateways ?? []).length === 0 && <div className="text-faint">kein Gateway</div>}
                    {(a.gateways ?? []).map((g) => (
                      <div key={g} className="text-fg">{g}</div>
                    ))}
                    {(a.dnsServers ?? []).map((d) => (
                      <div key={d} className="text-muted">DNS {d}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
                {[
                  ['MAC', a.mac ?? '—'],
                  ['MTU', a.mtu === null || a.mtu === undefined ? '—' : String(a.mtu)],
                  ['Medium', a.mediaType ?? '—'],
                  ['Index', a.ifIndex === null || a.ifIndex === undefined ? '—' : String(a.ifIndex)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="eyebrow">{label}</div>
                    <div className="mt-1 truncate font-mono text-[12.5px] text-fg" title={value}>{value}</div>
                  </div>
                ))}
              </div>

              {v6.length > 0 && (
                <details className="mt-3 border-t border-line pt-3">
                  <summary className="cursor-pointer font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
                    {v6.length} IPv6-Adressen
                  </summary>
                  <ul className="mt-2 space-y-1 font-mono text-[12px] text-faint">
                    {v6.map((ip) => (
                      <li key={ip.address} className="truncate">{ip.address}/{ip.prefix}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel code="DRV" title="Treiberdetails">
          <DataTable
            headers={['Adapter', 'Treiber', 'Stand', 'PNP-ID']}
            rows={adapters.map((a) => [a.name ?? '—', a.driver ?? '—', a.driverDate ? new Date(a.driverDate).toLocaleDateString('de-DE') : '—', a.pnpId ?? '—'])}
            empty="Keine Adapter."
          />
        </Panel>

        <Panel code="ADR" title="Adressen im Detail">
          <DataTable
            headers={['Adapter', 'Familie', 'Adresse', 'Präfix']}
            rows={adapters.flatMap((a) =>
              (a.addresses ?? []).map((ip) => [a.name ?? '—', ip.family ?? '—', ip.address ?? '—', ip.prefix === null || ip.prefix === undefined ? '—' : `/${ip.prefix}`]),
            )}
            empty="Keine Adressen."
          />
        </Panel>
      </div>

      <div className="rounded-lg border border-line bg-panel2 px-4 py-3.5">
        <KV
          items={[
            { label: 'Physische Adapter', value: String(hardware.length) },
            { label: 'Virtuelle Adapter', value: String(adapters.length - hardware.length) },
            { label: 'Belegtes Volumen (live)', value: tick?.rxBps !== null && tick?.rxBps !== undefined ? rate(tick.rxBps) : '—' },
            { label: 'Gesendet (live)', value: tick?.txBps !== null && tick?.txBps !== undefined ? rate(tick.txBps) : '—' },
            { label: 'Zählerbasis', value: 'Win32_PerfFormattedData_Tcpip_NetworkInterface' },
            { label: 'Schnellster Link', value: rate(Math.max(0, ...adapters.map((a) => a.speedBps ?? 0)), 'bit') },
          ]}
        />
      </div>

      <Panel
        code="LAN"
        title="Geräte im lokalen Netz"
        right={
          <div className="flex items-center gap-2">
            {scan && <Badge>{num(scan.probed)} Adressen in {num(Math.round(scan.ms / 100) / 10)} s</Badge>}
            {scanning ? (
              <button type="button" className="btn" onClick={() => void window.inspekt?.netScanCancel()}>
                Abbrechen
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => void startScan()} data-lan="scan">
                Netz durchsuchen
              </button>
            )}
          </div>
        }
      >
        {progress && scanning && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-muted">
              <span>Subnetz wird abgeklopft …</span>
              <span className="text-accent">
                {num(progress.done)} / {num(progress.total)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel2 ring-1 ring-line ring-inset">
              <div className="h-full bg-accent" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {scanError && (
          <div className="mb-4">
            <Notice tone="warn" title="Suche nicht möglich">
              {scanError}
            </Notice>
          </div>
        )}

        {!scan && !scanning && (
          <EmptyState title="Noch nicht gesucht">
            Der Knopf oben prüft die 254 Adressen des eigenen /24-Netzes mit einem Ping-Sweep und ergänzt MAC-Adresse und
            Hersteller aus der ARP-Tabelle. Dauert je nach Netz zwei bis zehn Sekunden und verlässt den Rechner nicht.
          </EmptyState>
        )}

        {scan && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <StatTile label="Subnetz" value={scan.subnet ?? '—'} hint={scan.interfaceName ? `über ${scan.interfaceName}` : undefined} />
              <StatTile label="Geprüft" value={num(scan.probed)} unit="Adressen" />
              <StatTile label="Gefunden" value={scan.devices.length} unit="Geräte" tone={scan.devices.length > 0 ? 'good' : 'default'} />
              <StatTile
                label="Router"
                value={scan.devices.filter((d) => (d.mac ?? '').startsWith('00') || d.vendor === 'Gateway').length > 0 ? 'im LAN' : 'unbekannt'}
                hint="Gerät mit网关-Funktion nicht zuverlässig erkennbar"
              />
            </div>

            <div className="mt-5">
              <DataTable
                headers={['IP-Adresse', 'MAC', 'Hersteller', 'Name', 'Gefunden über']}
                rows={scan.devices.map((d) => [
                  <span className="font-mono text-accent">{d.ip}</span>,
                  <span className="font-mono text-faint">{d.mac ?? '—'}</span>,
                  d.vendor ?? <span className="text-faint">nicht in der Liste</span>,
                  d.hostname ?? '—',
                  d.source === 'ping' ? 'Ping' : d.source === 'arp' ? 'ARP-Tabelle' : 'eigener Rechner',
                ])}
                empty="Keine Antwort im Subnetz."
              />
            </div>

            {scan.devices.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="eyebrow mb-2">Geräte nach Hersteller</div>
                <MiniBars
                  items={Object.entries(
                    scan.devices.reduce<Record<string, number>>((acc, d) => {
                      const key = d.vendor ?? 'unbekannt'
                      acc[key] = (acc[key] ?? 0) + 1
                      return acc
                    }, {}),
                  )
                    .sort((a, b) => b[1] - a[1])
                    .map(([vendor, count], i) => ({ id: `${vendor}-${i}`, label: vendor, value: count, display: String(count), unit: 'Geräte' }))}
                />
              </div>
            )}

            {scan.note && (
              <div className="mt-4">
                <Notice tone="warn" title="Hinweis zum Suchlauf">
                  {scan.note}
                </Notice>
              </div>
            )}
            <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-faint">
              Ping-Antwort sagt nur, dass jemand auf ICMP reagiert. Manche Geräte blockieren Ping, andere antworten darauf
              gar nicht – die Liste ist deshalb eine Momentaufnahme, kein lückenloses Inventar. Die Herstellerzuordnung nutzt
              eine kuratierte Liste bekannter OUI-Präfixe und bleibt bei unbekannten Einträgen leer.
            </p>
          </>
        )}
      </Panel>
    </div>
  )
}
