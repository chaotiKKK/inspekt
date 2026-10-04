import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChartOverlay } from './components/charts/ChartFrame.tsx'
import { SearchDialog } from './components/SearchDialog.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Topbar } from './components/Topbar.tsx'
import { Notice } from './components/ui.tsx'
import { useAppInfo, useSnapshot, useTelemetry } from './lib/hooks.ts'
import { NAV, navItem, type NavId } from './lib/nav.ts'
import { buildPortReport } from './lib/ports.ts'
import { baueIndex, kopieren, useSuche, type SearchHit } from './lib/search.ts'
import { applyTheme, updateSettings, useSettings } from './lib/settings.ts'
import { OverviewPage } from './pages/Overview.tsx'
import { MemoryPage } from './pages/Memory.tsx'
import { StoragePage } from './pages/Storage.tsx'
import { CpuPage } from './pages/Cpu.tsx'
import { GpuPage } from './pages/Gpu.tsx'
import { RechenkraftPage } from './pages/Rechenkraft.tsx'
import { BoardPage } from './pages/Board.tsx'
import { MonitorsPage } from './pages/Monitors.tsx'
import { NetworkPage } from './pages/Network.tsx'
import { DevicesPage } from './pages/Devices.tsx'
import { BatteryPage } from './pages/Battery.tsx'
import { SensorsPage } from './pages/Sensors.tsx'
import { ReportPage } from './pages/Report.tsx'
import { LoadingScreen } from './pages/Loading.tsx'
import type { PageProps } from './pages/PageProps.ts'

const PAGES: Record<NavId, (props: PageProps) => React.ReactNode> = {
  overview: OverviewPage,
  memory: MemoryPage,
  storage: StoragePage,
  cpu: CpuPage,
  gpu: GpuPage,
  bench: RechenkraftPage,
  board: BoardPage,
  monitors: MonitorsPage,
  network: NetworkPage,
  devices: DevicesPage,
  battery: BatteryPage,
  sensors: SensorsPage,
  export: ReportPage,
}

export default function App(): React.ReactNode {
  const [active, setActive] = useState<NavId>('overview')
  const settings = useSettings()
  const { snapshot, loading, progress, error, elevated, refresh, refreshSections, lastUpdate } = useSnapshot()
  const telemetry = useTelemetry(settings.telemetry)
  const appInfo = useAppInfo()
  const [elevateError, setElevateError] = useState<string | null>(null)

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  const report = useMemo(
    () => buildPortReport(snapshot?.sections.system.data ?? null, snapshot?.sections.storage.data ?? null, snapshot?.sections.memory.data ?? null, settings.override),
    [snapshot, settings.override],
  )

  const item = navItem(active)
  const Page = PAGES[active]

  const onElevate = useCallback(() => {
    const api = window.inspekt
    if (!api) return
    void api
      .relaunchElevated()
      .then((result) => {
        if (!result.requested) setElevateError(result.error ?? 'Der Neustart wurde abgebrochen.')
      })
      .catch((err: Error) => setElevateError(err.message))
  }, [])

  const onRefreshSection = useCallback(() => {
    if (item.sections.length > 0) void refreshSections(item.sections)
  }, [item, refreshSections])

  const index = useMemo(() => baueIndex(snapshot), [snapshot])
  const suche = useSuche(index, useCallback((hit: SearchHit) => setActive(hit.nav), []))

  const [kopiert, setKopiert] = useState<string | null>(null)
  const kopierenUndMelden = useCallback((text: string) => {
    void kopieren(text).then((ok) => {
      setKopiert(ok ? 'In die Zwischenablage kopiert.' : 'Kopieren nicht möglich.')
      setTimeout(() => setKopiert(null), 1600)
    })
  }, [])

  // Strg+1..9 springt direkt in einen Bereich
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      if (e.key === '/') {
        e.preventDefault()
        suche.oeffnen()
        return
      }
      const ziffer = Number(e.key)
      if (!Number.isInteger(ziffer) || ziffer < 1) return
      const ziel = NAV[ziffer - 1]
      if (!ziel) return
      e.preventDefault()
      setActive(ziel.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [suche])

  const pageProps: PageProps = {
    snapshot,
    loading,
    report,
    telemetry,
    elevated,
    onElevate,
    settings,
    patchSettings: updateSettings,
  }

  return (
    <div data-accent={active} className="flex h-full bg-bg text-fg">
      <Sidebar active={active} onSelect={setActive} version={appInfo?.version} elevated={elevated} onElevate={onElevate} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          item={item}
          loading={loading}
          progress={progress}
          onRefresh={() => void refresh()}
          onRefreshSection={onRefreshSection}
          lastUpdate={lastUpdate}
          theme={settings.theme}
          onToggleTheme={() => updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
        />

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1220px] px-6 py-6">
            {elevated === false && (
              <div className="mb-5">
                <Notice
                  tone="warn"
                  title="Standardbenutzer – manche Werte fehlen"
                  action={
                    <button type="button" className="btn" onClick={onElevate}>
                      Als Administrator starten
                    </button>
                  }
                >
                  Thermosensoren, einige Festplattenwerte und der TPM-Status werden nur mit erhöhten Rechten ausgelesen. Der Rest
                  funktioniert normal.
                </Notice>
              </div>
            )}

            {elevateError && (
              <div className="mb-5">
                <Notice tone="bad" title="Neustart nicht möglich">
                  {elevateError}
                </Notice>
              </div>
            )}

            {error && (
              <div className="mb-5">
                <Notice tone="bad" title="Auslesen fehlgeschlagen">
                  {error}
                </Notice>
              </div>
            )}

            {kopiert && (
              <div className="mb-5">
                <Notice tone="good" title="Kopiert">
                  {kopiert}
                </Notice>
              </div>
            )}

            {!snapshot ? <LoadingScreen progress={progress} loading={loading} /> : <Page {...pageProps} />}
          </div>
        </main>

        <footer className="border-t border-line px-6 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10.5px] text-faint">
            <span>
              Inspekt {appInfo?.version ? `v${appInfo.version}` : ''} · {NAV.length} Bereiche · Daten aus WMI/CIM, EDID und
              nvidia-smi
            </span>
            <span className="flex items-center gap-4">
              <button
                type="button"
                className="underline decoration-line2 underline-offset-2 transition-colors hover:text-accent"
                onClick={() => suche.oeffnen()}
                title="Strg+F"
              >
                Suchen (Strg+F)
              </button>
              {snapshot && <span>Datenstand {new Date(snapshot.collectedAt).toLocaleString('de-DE')}</span>}
              <button
                type="button"
                className="underline decoration-line2 underline-offset-2 transition-colors hover:text-accent"
                onClick={() => updateSettings({ telemetry: !settings.telemetry })}
              >
                Live-Messung {settings.telemetry ? 'an' : 'aus'}
              </button>
            </span>
          </div>
        </footer>
      </div>

      <SearchDialog suche={suche} onKopieren={kopierenUndMelden} />
      <ChartOverlay />
    </div>
  )
}
