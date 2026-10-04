import { KV, Notice, Panel, StatTile } from '../components/ui.tsx'
import { bytes, date, dateTime, dash, yesNo } from '../lib/format.ts'
import { chassisLabel, pcSystemType } from '../lib/labels.ts'
import type { PageProps } from './PageProps.ts'

export function BoardPage({ snapshot, elevated, onElevate }: PageProps): React.ReactNode {
  const sys = snapshot?.sections.system.data ?? null
  const sec = snapshot?.sections.security.data ?? null
  const tpm = sec?.tpm ?? null
  const dg = sec?.deviceGuard ?? null

  return (
    <div className="space-y-5">
      <section className="panel relative overflow-hidden px-6 py-6">
        <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden="true" />
        <div className="eyebrow">Chassis · {chassisLabel(sys?.chassisTypes) ?? '—'}</div>
        <h2 className="mt-2 font-mono text-[26px] leading-tight font-semibold tracking-tight text-fg">
          {sys?.boardMfr ?? '—'} {sys?.boardProduct ?? ''}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip">BIOS {sys?.biosVersion ?? '—'}</span>
          <span className="chip">{sys?.firmwareType ?? '—'}</span>
          <span className="chip">{pcSystemType(sys?.pcSystemType) ?? '—'}</span>
          <span className="chip">{dash(sys?.productVersion)}</span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="BIOS-Hersteller" value={sys?.biosVendor ?? '—'} hint={sys?.biosDate ? `ausgegeben ${date(sys.biosDate)}` : undefined} />
        <StatTile label="Mainboard" value={sys?.boardVersion ?? '—'} hint={sys?.boardMfr ?? undefined} />
        <StatTile label="Startmodus" value={sec?.bootMode ?? sys?.firmwareType ?? '—'} tone={sec?.secureBoot ? 'good' : 'warn'} hint={sec?.secureBoot === null || sec?.secureBoot === undefined ? undefined : sec.secureBoot ? 'Secure Boot aktiviert' : 'Secure Boot deaktiviert'} />
        <StatTile label="TPM" value={tpm?.present ? 'vorhanden' : tpm ? 'keins' : '—'} tone={tpm?.present ? 'good' : 'default'} hint={tpm?.manufacturer ?? tpm?.specVersion ?? undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel code="MB" title="Mainboard">
          <KV
            items={[
              { label: 'Hersteller', value: sys?.boardMfr ?? '—' },
              { label: 'Produkt', value: sys?.boardProduct ?? '—' },
              { label: 'Version', value: sys?.boardVersion ?? '—' },
              { label: 'Seriennummer', value: sys?.boardSerial ?? '—' },
              { label: 'Chassis-Hersteller', value: sys?.chassisMfr ?? '—' },
              { label: 'Chassis-Seriennummer', value: sys?.chassisSerial ?? '—' },
              { label: 'Produktfamilie', value: sys?.family ?? '—' },
              { label: 'Systemtyp', value: sys?.systemType ?? '—' },
              { label: 'SKU', value: sys?.sku ?? '—' },
            ]}
          />
        </Panel>

        <Panel code="BIO" title="BIOS / Firmware">
          <KV
            items={[
              { label: 'Hersteller', value: sys?.biosVendor ?? '—' },
              { label: 'Version', value: sys?.biosVersion ?? '—' },
              { label: 'Ausgabedatum', value: sys?.biosDate ? date(sys.biosDate) : '—' },
              { label: 'SMBIOS-Version', value: sys?.smbiosVersion ?? 'nicht gemeldet' },
              { label: 'Firmware-Typ', value: sys?.firmwareType ?? '—' },
              { label: 'Windows-Verzeichnis', value: sys?.windowsDir ?? '—' },
              { label: 'Letzter Start', value: sys?.lastBoot ? dateTime(sys.lastBoot) : '—' },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel code="SEC" title="Sicherheit">
          <KV
            items={[
              { label: 'Secure Boot', value: sec?.secureBoot === null || sec?.secureBoot === undefined ? '—' : yesNo(sec.secureBoot) },
              { label: 'Startmodus', value: sec?.bootMode ?? '—' },
              { label: 'TPM vorhanden', value: tpm?.present === null || tpm?.present === undefined ? '—' : yesNo(tpm.present) },
              { label: 'TPM bereit', value: tpm?.ready === null || tpm?.ready === undefined ? '—' : yesNo(tpm.ready) },
              { label: 'TPM hergestellt von', value: tpm?.manufacturer ?? '—' },
              { label: 'TPM-Spezifikation', value: tpm?.specVersion ?? '—' },
              { label: 'VBS (Virtualisierungsbasierte Sicherheit)', value: dg ? (dg.vbsStatus === 1 ? 'aktiv' : dg.vbsStatus === 2 ? 'nicht aktiv' : `Code ${dg.vbsStatus}`) : '—' },
              { label: 'Anmeldeinformationsguard', value: dg?.credentialGuard === null || dg?.credentialGuard === undefined ? '—' : yesNo(dg.credentialGuard) },
              { label: 'HVCI (Memory Integrity)', value: dg?.hvci === null || dg?.hvci === undefined ? '—' : yesNo(dg.hvci) },
            ]}
          />
          {sec?.secureBootError && (
            <div className="mt-4">
              <Notice tone="warn" title="Secure Boot konnte nicht gelesen werden">
                {sec.secureBootError}
              </Notice>
            </div>
          )}
          {elevated === false && (
            <div className="mt-4">
              <Notice tone="warn" title="TPM-Status unvollständig" action={<button className="btn" onClick={onElevate}>Als Administrator starten</button>}>
                Die TPM-Abfrage antwortet nur mit erhöhten Rechten. Secure Boot und Startmodus werden dagegen über die
                Registry gelesen und sind korrekt.
              </Notice>
            </div>
          )}
        </Panel>

        <Panel code="SYS" title="Systemkennung">
          <KV
            items={[
              { label: 'Hostname', value: sys?.hostname ?? '—' },
              { label: 'Benutzer', value: sys?.user ?? '—' },
              { label: 'Domäne', value: sys?.domain ?? '—' },
              { label: 'Seriennummer', value: sys?.serialNumber ?? '—' },
              { label: 'UUID', value: sys?.uuid ?? '—' },
              { label: 'Hersteller', value: sys?.manufacturer ?? '—' },
              { label: 'Modell', value: sys?.model ?? '—' },
              { label: 'Primärer Besitzer', value: sys?.primaryOwner ?? '—' },
            ]}
          />
          {sys?.license && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="eyebrow mb-2">Windows-Lizenz</div>
              <div className="rounded border border-line bg-panel2 px-3 py-2.5">
                <div className="text-[13px] text-fg">{sys.license.name ?? '—'}</div>
                <div className="mt-1 font-mono text-[11px] text-faint">Teilschlüssel: {sys.license.partialKey ?? '—'}</div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel code="OS" title="Betriebssystem">
        <KV
          items={[
            { label: 'Edition', value: sys?.osCaption ?? '—' },
            { label: 'Version', value: sys?.osVersion ?? '—' },
            { label: 'Build', value: sys?.osBuild ?? '—' },
            { label: 'Architektur', value: sys?.osArchitecture ?? '—' },
            { label: 'Installation', value: sys?.osInstallDate ? date(sys.osInstallDate) : '—' },
            { label: 'Arbeitsspeicher gesamt', value: bytes(sys?.totalMemory) },
            { label: 'Logische Prozessoren', value: sys?.logicalCpus === null || sys?.logicalCpus === undefined ? '—' : String(sys.logicalCpus) },
            { label: 'Physikalische Sockel', value: sys?.sockets === null || sys?.sockets === undefined ? '—' : String(sys.sockets) },
          ]}
        />
      </Panel>
    </div>
  )
}
