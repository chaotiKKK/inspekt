import { Moon, RefreshCw, RotateCw, Sun } from 'lucide-react'
import { navLabel, type NavItem } from '../lib/nav.ts'
import { t } from '../lib/i18n'
import { clock } from '../lib/format.ts'
import type { Theme } from '../lib/settings.ts'

export const SECTION_CODES: Record<string, string> = {
  system: 'SYS',
  cpu: 'CPU',
  memory: 'DIMM',
  storage: 'STG',
  gpu: 'GPU',
  monitors: 'LCD',
  network: 'NIC',
  devices: 'PNP',
  battery: 'BAT',
  security: 'SEC',
  sensors: 'TMP',
}

const ALL_CODES = Object.values(SECTION_CODES)

export function Topbar({
  item,
  loading,
  progress,
  onRefresh,
  onRefreshSection,
  lastUpdate,
  theme,
  onToggleTheme,
}: {
  item: NavItem
  loading: boolean
  progress: string[]
  onRefresh: () => void
  onRefreshSection: () => void
  lastUpdate: number | null
  theme: Theme
  onToggleTheme: () => void
}): React.ReactNode {
  const done = progress.length
  const total = ALL_CODES.length

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 py-3.5">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="font-mono text-[11px] font-semibold tracking-[0.18em] text-accent">{item.code}</span>
          <h1 className="truncate text-[17px] font-semibold tracking-tight text-fg">{navLabel(item)}</h1>
        </div>

        <div className="hidden items-center gap-2 md:flex" aria-hidden="true">
          {ALL_CODES.map((code) => {
            const section = Object.entries(SECTION_CODES).find(([, c]) => c === code)?.[0] ?? ''
            const active = progress.includes(section)
            return (
              <span
                key={code}
                className={[
                  'h-3.5 w-6 rounded-[2px] border transition-colors duration-300',
                  active ? 'border-accent bg-accent/70' : loading ? 'border-line2 bg-panel2' : 'border-line bg-panel2',
                ].join(' ')}
                title={active ? t('top.read', '{code} gelesen', { code }) : t('top.pending', '{code} ausstehend', { code })}
              />
            )
          })}
          <span className="ml-1 font-mono text-[11px] text-faint">
            {loading ? `${done}/${total}` : `${total}/${total}`}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {lastUpdate && !loading && (
            <span className="hidden font-mono text-[11px] text-faint sm:inline">{t('top.stand', 'Stand')} {clock(lastUpdate)}</span>
          )}
          <button type="button" className="btn" onClick={onRefreshSection} disabled={loading || item.sections.length === 0}>
            <RotateCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {t('top.section', 'Bereich')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {loading ? t('top.running', 'Läuft …') : t('top.refresh', 'Aktualisieren')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Dunkles Design verwenden' : 'Helles Design verwenden'}
          >
            {theme === 'light' ? <Moon size={13} aria-hidden="true" /> : <Sun size={13} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {loading && (
        <div className="h-[2px] w-full overflow-hidden bg-panel2">
          <div
            className="h-full w-1/3 rounded-full bg-accent"
            style={{ animation: 'scan 1.4s ease-in-out infinite' }}
            aria-hidden="true"
          />
        </div>
      )}

      <style>{`@keyframes scan { 0% { transform: translateX(-110%); } 100% { transform: translateX(320%); } }`}</style>
    </header>
  )
}
