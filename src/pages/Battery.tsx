import { MiniBars } from '../components/charts/Mini.tsx'
import { Badge, KV, Notice, Panel, Ring, StatTile } from '../components/ui.tsx'
import { bytes, num, percent } from '../lib/format.ts'
import { batteryChemistry, batteryStatus } from '../lib/labels.ts'
import type { PageProps } from './PageProps.ts'

export function BatteryPage({ snapshot, elevated, onElevate }: PageProps): React.ReactNode {
  const bat = snapshot?.sections.battery.data ?? null
  const battery = bat?.batteries?.[0] ?? null
  const state = bat?.state ?? null
  const full = battery?.fullCapacity ?? null
  const design = battery?.designCapacity ?? null
  const healthPct = full && design ? (full / design) * 100 : null
  const runtimeMin = battery?.estimatedRunTimeMin ?? null
  const runtime = runtimeMin !== null && runtimeMin > 0 && runtimeMin < 60000 ? runtimeMin : null

  if (!bat?.present) {
    return (
      <div className="space-y-5">
        <Notice tone="neutral" title="Kein Akku verbaut">
          Dieses System meldet keinen Akku. Das ist bei Desktop-PCs und Servern normal.
        </Notice>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Ladung" value={battery?.chargePercent ?? '—'} unit="%" tone={(battery?.chargePercent ?? 100) < 20 ? 'bad' : (battery?.chargePercent ?? 100) < 40 ? 'warn' : 'good'} hint={battery ? batteryStatus(battery.statusCode) ?? battery.status ?? '—' : undefined} />
        <StatTile label="Ist-Kapazität" value={full ? bytes(full * 1000) : '—'} hint={design ? `Nennung ${bytes(design * 1000)}` : 'Nennung wird nicht gemeldet'} />
        <StatTile label="Gesundheit" value={healthPct ? percent(healthPct) : '—'} tone={healthPct ? (healthPct > 85 ? 'good' : healthPct > 70 ? 'warn' : 'bad') : 'default'} hint={healthPct ? 'Ist / Nenn' : 'nicht berechenbar'} />
        <StatTile label="Ladezyklen" value={bat.cycleCount === null || bat.cycleCount === undefined ? '—' : num(bat.cycleCount)} hint={state?.powerOnline ? 'Netzstrom angeschlossen' : 'im Akkubetrieb'} />
      </div>

      <Panel code="CAP" title="Kapazität im Vergleich">
        <MiniBars
          items={[
            ...(design ? [{ id: 'design', label: 'Nennkapazität', value: design, display: `${num(design / 1000, 1)} Wh`, color: '#64748b', hint: 'Werksangabe' }] : []),
            ...(full ? [{ id: 'full', label: 'Ist-Kapazität', value: full, display: `${num(full / 1000, 1)} Wh`, hint: healthPct ? `${percent(healthPct)} der Nennung` : undefined }] : []),
            ...(full && battery?.chargePercent
              ? [{ id: 'charge', label: 'Aktuell gespeichert', value: full * (battery.chargePercent / 100), display: `${num((full * (battery.chargePercent / 100)) / 1000, 1)} Wh`, color: '#10b981', hint: `${battery.chargePercent} % geladen` }]
              : []),
          ]}
          empty="Dieser Akku meldet keine Kapazitätswerte."
        />
        {!design && (
          <p className="mt-3 border-t border-line pt-3 font-mono text-[10.5px] text-faint">
            Nennkapazität wird von diesem Modell nicht gemeldet – nur Ist-Werte und Ladestand.
          </p>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Panel code="BAT" title="Ladung">
          <Ring percent={battery?.chargePercent ?? 0} label="Ladestand" size={150} />
          <div className="mt-5 space-y-3 border-t border-line pt-4">
            <KV
              columns={1}
              items={[
                { label: 'Status', value: batteryStatus(battery?.statusCode) ?? battery?.status ?? '—' },
                { label: 'Chemie', value: batteryChemistry(battery?.chemistry) ?? '—' },
                { label: 'Nennspannung', value: battery?.designVoltage ? `${num(battery.designVoltage / 1000, 2)} V` : '—' },
                { label: 'Restlaufzeit', value: runtime ? `${Math.floor(runtime / 60)} Min.` : 'nicht begrenzt / unbekannt' },
              ]}
            />
          </div>
        </Panel>

        <Panel code="ST" title="Zustand">
          <KV
            items={[
              { label: 'Netzstrom', value: state?.powerOnline === null || state?.powerOnline === undefined ? '—' : state.powerOnline ? 'angeschlossen' : 'getrennt' },
              { label: 'Wird geladen', value: state?.charging === null || state?.charging === undefined ? '—' : state.charging ? 'ja' : 'nein' },
              { label: 'Entlädt', value: state?.discharging === null || state?.discharging === undefined ? '—' : state.discharging ? 'ja' : 'nein' },
              { label: 'Verbleibend', value: state?.remainingMwh ? bytes(state.remainingMwh * 1000) : '—' },
              { label: 'Ladestrom', value: state?.chargeRateMw ? `${num(state.chargeRateMw / 1000, 1)} W` : '0 W' },
              { label: 'Entladestrom', value: state?.dischargeRateMw ? `${num(state.dischargeRateMw / 1000, 1)} W` : '0 W' },
              { label: 'Spannung', value: state?.voltageMv ? `${num(state.voltageMv / 1000, 2)} V` : '—' },
              { label: 'Modul', value: battery?.name ?? '—' },
              { label: 'Bezeichnung', value: battery?.caption ?? '—' },
            ]}
          />

          <div className="mt-5 border-t border-line pt-4">
            {!design && (
              <div className="mb-4">
                <Notice tone="neutral" title="Nennkapazität wird nicht gemeldet">
                  HP liefert in diesem Modell nur die Ist-Kapazität. Ein Vergleich „Ist gegen Nenn“ ist deshalb nicht möglich –
                  der Akkuzähler und die Kapazität stehen trotzdem richtig da.
                </Notice>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">{battery ? 'verbaut' : 'keiner'}</Badge>
              <Badge>{batteryChemistry(battery?.chemistry) ?? 'Chemie unbekannt'}</Badge>
              {state?.active && <Badge tone="good">aktiv</Badge>}
              {state?.critical && <Badge tone="bad">kritisch</Badge>}
            </div>
          </div>
        </Panel>
      </div>

      <Panel code="RAW" title="Rohe Akkudaten">
        <KV
          items={[
            { label: 'Kapazität (Wh)', value: full ? `${num(full / 1000, 1)} Wh` : '—' },
            { label: 'Nennkapazität (Wh)', value: design ? `${num(design / 1000, 1)} Wh` : 'wird nicht gemeldet' },
            { label: 'Zeit bis voll', value: battery?.timeToFullMin ? `${battery.timeToFullMin} Min.` : '—' },
            { label: 'Schätzlaufzeit (Min.)', value: runtimeMin === null || runtimeMin === undefined ? '—' : num(runtimeMin) },
            { label: 'Statuscode', value: battery?.statusCode === null || battery?.statusCode === undefined ? '—' : String(battery.statusCode) },
            { label: 'Aufladbar', value: battery?.rechargeable === null || battery?.rechargeable === undefined ? '—' : battery.rechargeable ? 'ja' : 'nein' },
          ]}
        />
        {elevated === false && (
          <div className="mt-5">
            <Notice tone="warn" title="Genauere Zähler mit erhöhten Rechten" action={<button className="btn" onClick={onElevate}>Als Administrator starten</button>}>
              Ladung, Kapazität und Zyklen sind vollständig da. Detaillierte Zähler des Herstellers sind nur mit
              Administratorrechten sichtbar.
            </Notice>
          </div>
        )}
      </Panel>
    </div>
  )
}
