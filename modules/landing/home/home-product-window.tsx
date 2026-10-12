import { Container } from '../components/section-heading'
import { WindowFrame } from '../components/window-frame'

const STUDIO_STEPS: { done: boolean; text: string; name?: string }[] = [
  { done: true, text: 'model', name: 'loan · 6 fields · 4 ops' },
  { done: true, text: 'editor', name: 'loan-editor' },
  { done: true, text: 'processor', name: 'overdue-check' },
  { done: true, text: 'tests', name: '12/12' },
  { done: false, text: 'publishing', name: '@acme/loans 0.1.0 …' },
]

const SERVICES = [
  { name: 'Connect', state: 'running' },
  { name: 'Switchboard', state: 'running' },
  { name: 'Agent', state: 'running' },
  { name: 'Docling', state: 'add-on' },
]

const PACKAGES = [
  { name: '@acme/invoices', version: '1.4.0', status: 'installed', warn: false },
  { name: '@acme/loans', version: '0.1.0', status: 'rolling out', warn: true },
]

export function HomeProductWindow() {
  return (
    <section>
      <Container className="pb-24">
        <WindowFrame
          title="vetra.io/console · acme"
          label="The Vetra console: a Studio session building a loans app on the left, the Cloud environment it deploys to on the right"
        >
          <div className="flex flex-wrap">
            <div className="border-console-line flex min-w-0 flex-[1_1_420px] flex-col gap-4 border-b p-5 text-sm md:border-r md:border-b-0">
              <p className="font-console-mono text-console-faint text-xs">STUDIO · session 14</p>
              <p className="bg-console-raised rounded-lg px-4 py-3 leading-relaxed">
                Track hardware loans. A loan has a borrower, items, a due date, and goes overdue
                automatically.
              </p>
              <ul className="font-console-mono text-console-muted flex flex-col gap-1.5 text-[13px]">
                {STUDIO_STEPS.map((s) => (
                  <li key={s.text}>
                    <span className={s.done ? 'text-console-signal' : 'text-console-warn'}>
                      {s.done ? '✓' : '●'}
                    </span>{' '}
                    {s.text} <span className="text-console-ink">{s.name}</span>
                  </li>
                ))}
              </ul>
              <p className="border-console-line-strong text-console-faint mt-auto flex justify-between rounded-lg border px-4 py-3">
                Ask Studio to change something…<span className="font-console-mono">↵</span>
              </p>
            </div>
            <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-console-mono text-console-faint text-xs">CLOUD · acme-ops</p>
                <p className="font-console-mono text-console-signal text-[13px]">
                  acme-ops.vetra.io ↗
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {SERVICES.map((s) => (
                  <div key={s.name} className="bg-console-raised rounded-lg p-3.5">
                    <p className="text-console-faint text-xs">{s.name}</p>
                    <p className="mt-1 text-[15px]">
                      <span
                        className={
                          s.state === 'running' ? 'text-console-signal' : 'text-console-faint'
                        }
                      >
                        {s.state === 'running' ? '●' : '○'}
                      </span>{' '}
                      {s.state}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-console-line-strong overflow-x-auto rounded-lg border">
                <table className="font-console-mono w-full min-w-[420px] border-collapse text-[13px]">
                  <thead>
                    <tr className="text-console-faint text-left">
                      <th className="px-3.5 py-2.5 font-medium">package</th>
                      <th className="px-3.5 py-2.5 font-medium">version</th>
                      <th className="px-3.5 py-2.5 font-medium">status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PACKAGES.map((p) => (
                      <tr key={p.name} className="border-console-line border-t">
                        <td className="px-3.5 py-2.5">{p.name}</td>
                        <td className="px-3.5 py-2.5">{p.version}</td>
                        <td
                          className={`px-3.5 py-2.5 ${p.warn ? 'text-console-warn' : 'text-console-signal'}`}
                        >
                          {p.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="font-console-mono text-console-faint flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <span>backup 02:00 ✓</span>
                <span>custom domain ops.acme.com ✓</span>
              </p>
            </div>
          </div>
        </WindowFrame>
      </Container>
    </section>
  )
}
