import { Container } from '../components/section-heading'
import { WindowFrame } from '../components/window-frame'

const ENVIRONMENTS = [
  { name: 'acme-ops', active: true, state: '●' },
  { name: 'acme-staging', active: false, state: '●' },
  { name: 'frank-studio', active: false, state: '◐' },
]
const TABS = ['overview', 'packages', 'domains', 'secrets', 'backups', 'logs', 'database']
const SERVICES = ['Connect', 'Switchboard', 'Fusion', 'Agent']
const CPU_BARS = [30, 42, 38, 55, 70, 62, 48, 35, 44, 58, 66, 52]
const EVENTS = [
  { at: '02:00', kind: 'backup', text: 'completed · 184 MB', warn: false },
  { at: '11:41', kind: 'package', text: '@acme/loans 0.1.0 installed', warn: false },
  { at: '11:38', kind: 'domain', text: 'ops.acme.com certificate issued', warn: false },
  { at: '09:02', kind: 'update', text: 'platform update available', warn: true },
]

export function CloudEnvironmentWindow() {
  return (
    <section>
      <Container className="pb-24">
        <WindowFrame
          title="vetra.io/console/env/acme-ops"
          label="An environment in the Vetra console: running services, CPU usage over 24 hours and recent events"
        >
          <div className="flex flex-wrap">
            <nav
              aria-hidden
              className="border-console-line font-console-mono text-console-muted flex min-w-0 flex-[0_1_200px] flex-col gap-0.5 border-r p-3 text-[13px] max-sm:hidden"
            >
              <p className="text-console-faint px-2.5 pt-1 pb-2.5 text-[11px]">ENVIRONMENTS</p>
              {ENVIRONMENTS.map((e) => (
                <p
                  key={e.name}
                  className={`flex justify-between rounded-md px-2.5 py-2 ${e.active ? 'bg-console-raised text-console-ink' : ''}`}
                >
                  {e.name}
                  <span className={e.state === '●' ? 'text-console-signal' : 'text-console-faint'}>
                    {e.state}
                  </span>
                </p>
              ))}
              <p className="text-console-signal px-2.5 py-2">+ new environment</p>
            </nav>
            <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-4 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xl font-semibold">acme-ops</p>
                <p className="font-console-mono text-console-signal text-[13px]">
                  ops.acme.com ↗{' '}
                  <span className="text-console-faint">· tall-duck-ab12.vetra.io</span>
                </p>
              </div>
              <p className="border-console-line font-console-mono text-console-faint flex flex-wrap gap-x-5 border-b text-[13px]">
                {TABS.map((t, i) => (
                  <span
                    key={t}
                    className={
                      i === 0 ? 'border-console-signal text-console-ink border-b-2 py-2' : 'py-2'
                    }
                  >
                    {t}
                  </span>
                ))}
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {SERVICES.map((s) => (
                  <div key={s} className="bg-console-raised rounded-lg p-3.5">
                    <p className="text-console-faint text-xs">{s}</p>
                    <p className="mt-1 text-[15px]">
                      <span className="text-console-signal">●</span> running
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="border-console-line-strong flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 rounded-lg border p-3.5">
                  <p className="font-console-mono text-console-faint flex justify-between text-xs">
                    <span>cpu · 24h</span>
                    <span>2 vCPU</span>
                  </p>
                  <div className="flex h-16 items-end gap-1">
                    {CPU_BARS.map((h, i) => (
                      <div
                        key={i}
                        className={`console-bar flex-1 rounded-sm ${i >= CPU_BARS.length - 2 ? 'bg-console-signal' : 'bg-[#2a3a33]'}`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
                <ul className="border-console-line-strong font-console-mono text-console-muted min-w-0 flex-[1_1_260px] rounded-lg border p-3.5 text-xs leading-loose">
                  <li className="text-console-faint">events</li>
                  {EVENTS.map((e) => (
                    <li key={e.at}>
                      <span className="text-console-faint">{e.at}</span>{' '}
                      <span className={e.warn ? 'text-console-warn' : 'text-console-signal'}>
                        {e.kind}
                      </span>{' '}
                      {e.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </WindowFrame>
      </Container>
    </section>
  )
}
