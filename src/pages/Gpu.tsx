import { MiniBars } from '../components/charts/Mini.tsx'
import { Badge, Meter, Notice, Panel, Ring, Sparkline, StatTile } from '../components/ui.tsx'
import { bytes, celsius, mhz, num, percent, watt } from '../lib/format.ts'
import type { PageProps } from './PageProps.ts'

export function GpuPage({ snapshot, telemetry, elevated, onElevate }: PageProps): React.ReactNode {
  const gpu = snapshot?.sections.gpu.data ?? null
  const adapters = gpu?.adapters ?? []
  const nv = gpu?.nvidia ?? null
  const tick = telemetry.tick
  const tempHistory = telemetry.history.map((h) => h.gpuTempC ?? 0)
  const utilHistory = telemetry.history.map((h) => h.gpuUtilPct ?? 0)

  const temp = tick?.gpuTempC ?? nv?.tempC ?? null
  const util = tick?.gpuUtilPct ?? nv?.utilPct ?? null
  const memUsed = tick?.gpuMemUsedMb ?? nv?.memUsedMb ?? null
  const memTotal = tick?.gpuMemTotalMb ?? nv?.memTotalMb ?? null
  const power = tick?.gpuPowerW ?? nv?.powerW ?? null

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Grafikprozessoren" value={adapters.length} hint={adapters[0]?.name ?? '—'} />
        <StatTile label="GPU-Temperatur" value={temp !== null ? celsius(temp) : '—'} tone={temp !== null && temp > 80 ? 'warn' : 'default'} hint={nv ? `nvidia-smi · Treiber ${nv.driverVersion ?? '—'}` : gpu?.nvidiaError ?? undefined} />
        <StatTile label="Grafikspeicher" value={memUsed !== null ? num(memUsed) : '—'} unit={memTotal !== null ? `/ ${num(memTotal)} MiB` : 'MiB'} hint={memTotal ? percent((memUsed ?? 0) / memTotal * 100) : undefined} />
        <StatTile label="Leistungsaufnahme" value={power !== null ? watt(power) : '—'} hint={nv?.clockSmMhz ? `Takt ${mhz(nv.clockSmMhz)}` : undefined} />
      </div>

      {nv && (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <Panel code="NV" title="NVIDIA live">
            <Ring percent={util} label="Auslastung" />
            <div className="mt-5 grid gap-4 border-t border-line pt-4">
              <div className="text-center">
                <div className={`font-mono text-[30px] leading-none font-semibold ${temp !== null && temp > 80 ? 'text-amber-500' : 'text-fg'}`}>
                  {temp !== null ? celsius(temp) : '—'}
                </div>
                <div className="eyebrow mt-1.5">Temperatur</div>
              </div>
            </div>
          </Panel>

          <Panel code="LIVE" title="Karte in Echtzeit">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4">
                <Meter label="Speicher belegt" value={memTotal ? ((memUsed ?? 0) / memTotal) * 100 : 0} suffix=" %" tone={memTotal && (memUsed ?? 0) / memTotal > 0.9 ? 'warn' : 'good'} />
                <Meter label="Auslastung" value={util} suffix=" %" tone={(util ?? 0) > 90 ? 'warn' : undefined} />
                <Meter
                  label="Leistung"
                  value={power}
                  max={nv.powerLimitW && nv.powerLimitW > 0 ? nv.powerLimitW : Math.max(1, (power ?? 1) * 1.25)}
                  suffix=" W"
                  tone={nv.powerLimitW && power !== null && power / nv.powerLimitW > 0.9 ? 'warn' : 'good'}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <div className="eyebrow mb-1.5">Temperaturverlauf</div>
                  <Sparkline values={tempHistory} />
                </div>
                <div>
                  <div className="eyebrow mb-1.5">Auslastungsverlauf</div>
                  <Sparkline values={utilHistory} />
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['SM-Takt', nv.clockSmMhz ? mhz(nv.clockSmMhz) : '—'],
                ['Max. SM-Takt', nv.clockMaxSmMhz ? mhz(nv.clockMaxSmMhz) : '—'],
                ['Speichertakt', nv.clockMemMhz ? `${num(nv.clockMemMhz)} MHz` : '—'],
                ['Lüfter', nv.fanPct !== null && nv.fanPct !== undefined ? percent(nv.fanPct) : 'n/a'],
                ['Spitzenlast', nv.powerLimitW ? watt(nv.powerLimitW) : 'n/a'],
                ['Treiber', nv.driverVersion ?? '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="eyebrow">{label}</div>
                  <div className="mt-1 font-mono text-[14px] text-fg">{value}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {!nv && (
        <Notice tone="warn" title={gpu?.nvidiaError ?? 'Keine NVIDIA-Daten'}>
          Die NVIDIA-Werte kommen von <span className="font-mono">nvidia-smi</span>. Ist die Karte über die Hersteller-Software
          nicht ansprechbar oder nicht installiert, fehlen Temperatur und Auslastung. Die Windows-Adapterdaten bleiben davon
          unberührt.
        </Notice>
      )}

      <Panel code="ADP" title="Grafikadapter">
        {adapters.filter((a) => (a.adapterRam ?? 0) > 0).length > 1 && (
          <div className="mb-5 border-b border-line pb-5">
            <div className="eyebrow mb-2">Gemeldeter Grafikspeicher je Adapter</div>
            <MiniBars
              items={adapters
                .filter((a) => (a.adapterRam ?? 0) > 0)
                .map((a, i) => ({
                  id: `${a.pnpId ?? i}`,
                  label: a.name ?? `Adapter ${i + 1}`,
                  value: a.adapterRam ?? 0,
                  display: bytes(a.adapterRam ?? 0),
                  hint: a.vramSource ?? undefined,
                }))}
            />
          </div>
        )}
        <div className="grid gap-5 lg:grid-cols-2">
          {adapters.map((a, i) => (
            <div key={`${a.pnpId ?? i}`} className="rounded-lg border border-line bg-panel2 px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="eyebrow">Adapter {i + 1}</div>
                  <h3 className="mt-1.5 font-mono text-[15px] font-semibold text-fg">{a.name ?? '—'}</h3>
                </div>
                <div className="flex gap-2">
                  <Badge tone={a.status === 'OK' ? 'good' : 'neutral'}>{a.status ?? '—'}</Badge>
                  <Badge>{a.vramSource ?? '—'}</Badge>
                  {a.pcie && <Badge tone="accent">{a.pcie.text}{a.pcie.linkSpeed ? ` · ${a.pcie.linkSpeed}` : ''}</Badge>}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded border border-line px-3 py-2">
                <span className="eyebrow">Grafikspeicher</span>
                <span className="font-mono text-[14px] text-fg">{bytes(a.adapterRam)}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="eyebrow">Treiber</div>
                  <div className="mt-1 font-mono text-[13px] text-fg">{a.driver ?? '—'}</div>
                  <div className="font-mono text-[11px] text-faint">{a.driverDate ? new Date(a.driverDate).toLocaleDateString('de-DE') : '—'}</div>
                </div>
                <div>
                  <div className="eyebrow">Aktuelle Auflösung</div>
                  <div className="mt-1 font-mono text-[13px] text-fg">
                    {a.resolutionH && a.resolutionV ? `${a.resolutionH} × ${a.resolutionV}` : '—'}
                    {a.refreshHz ? ` @ ${a.refreshHz} Hz` : ''}
                  </div>
                  <div className="truncate font-mono text-[11px] text-faint" title={a.modeDesc ?? ''}>{a.modeDesc ?? '—'}</div>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-line pt-3 font-mono text-[11px] text-faint">
                <div className="truncate" title={a.pnpId ?? ''}>PNP: {a.pnpId ?? '—'}</div>
                <div className="truncate" title={a.processor ?? ''}>GPU: {a.processor ?? '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {elevated === false && (
        <Notice tone="warn" title="Temperaturen ohne Administratorrechte" action={<button className="btn" onClick={onElevate}>Als Administrator starten</button>}>
          nvidia-smi funktioniert unabhängig von Windows-Rechten. AMD- und Mainboard-Sensoren werden dagegen nur mit
          erhöhten Rechten gelesen.
        </Notice>
      )}
    </div>
  )
}
