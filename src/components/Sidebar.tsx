import {
  BatteryCharging,
  CircuitBoard,
  Cpu,
  FileDown,
  Gauge,
  HardDrive,
  LayoutDashboard,
  MemoryStick,
  Monitor,
  MonitorCog,
  Network,
  ShieldCheck,
  Thermometer,
  Usb,
  type LucideIcon,
} from 'lucide-react'
import { navLabel, NAV, type NavId } from '../lib/nav.ts'

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  MemoryStick,
  HardDrive,
  Cpu,
  MonitorCog,
  Gauge,
  CircuitBoard,
  Monitor,
  Network,
  Usb,
  BatteryCharging,
  Thermometer,
  FileDown,
}

export function Sidebar({
  active,
  onSelect,
  version,
  elevated,
  onElevate,
}: {
  active: NavId
  onSelect: (id: NavId) => void
  version?: string
  elevated: boolean | null
  onElevate: () => void
}): React.ReactNode {
  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="border-b border-line px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded border border-accent/50 bg-accent/12">
            <ShieldCheck size={15} className="text-accent" aria-hidden="true" />
          </span>
          <span className="font-mono text-[15px] font-semibold tracking-[0.2em] text-fg">INSPEKT</span>
        </div>
        <div className="mt-2 font-mono text-[10.5px] tracking-[0.1em] text-faint">
          HARDWARE-INVENTAR{version ? ` · v${version}` : ''}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Bereiche">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard
            const selected = item.id === active
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={[
                    'group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                    selected ? 'bg-accent/12 text-fg' : 'text-muted hover:bg-panel2 hover:text-fg',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'w-[34px] shrink-0 font-mono text-[10px] font-semibold tracking-[0.1em]',
                      selected ? 'text-accent' : 'text-faint group-hover:text-accent/70',
                    ].join(' ')}
                  >
                    {item.code}
                  </span>
                  <Icon size={15} className={selected ? 'text-accent' : 'text-muted'} aria-hidden="true" />
                  <span className="truncate text-[13px]">{navLabel(item)}</span>
                  {selected && <span className="ml-auto h-4 w-[2px] rounded-full bg-accent" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-line px-4 py-4">
        {elevated === false && (
          <button type="button" onClick={onElevate} className="btn mb-3 w-full justify-center">
            Als Administrator starten
          </button>
        )}
        <div className="space-y-1.5 font-mono text-[10.5px] leading-relaxed text-faint">
          <div className="flex items-center justify-between gap-2">
            <span>Rechte</span>
            <span className={elevated === true ? 'text-emerald-500' : elevated === false ? 'text-amber-500' : 'text-muted'}>
              {elevated === true ? 'erweitert' : elevated === false ? 'Standard' : '…'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Quelle</span>
            <span className="text-muted">WMI / CIM</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
