import { SECTION_CODES } from '../components/Topbar.tsx'

const ALL = Object.entries(SECTION_CODES)

export function LoadingScreen({ progress, loading }: { progress: string[]; loading: boolean }): React.ReactNode {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="panel h-[92px] animate-pulse px-4 py-3.5">
            <div className="h-2.5 w-24 rounded bg-panel2" />
            <div className="mt-3 h-6 w-32 rounded bg-panel2" />
          </div>
        ))}
      </div>

      <section className="panel px-5 py-5">
        <div className="eyebrow">{loading ? 'Hardware wird gelesen' : 'Warte auf den Sammler'}</div>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-muted">
          Inspekt startet mehrere PowerShell-Prozesse parallel. Je nach System dauert das rund 3–8 Sekunden; die ersten
          WMI-Abfragen sind am langsamsten.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ALL.map(([section, code]) => {
            const done = progress.includes(section)
            return (
              <li
                key={section}
                className={[
                  'flex items-center gap-3 rounded-md border px-3 py-2 font-mono text-[11.5px] transition-colors',
                  done ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line bg-panel2 text-faint',
                ].join(' ')}
              >
                <span className={`h-2 w-2 rounded-full ${done ? 'bg-accent' : 'bg-line2'}`} aria-hidden="true" />
                <span className="w-9 tracking-[0.12em]">{code}</span>
                <span className="truncate">{section}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
