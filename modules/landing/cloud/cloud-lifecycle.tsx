import { Container, SectionHeading } from '../components/section-heading'

const LOG = [
  { at: '14:02', text: 'environment', strong: 'acme-ops', rest: 'created · 2 vCPU' },
  { at: '14:03', text: 'connect, switchboard, fusion up' },
  { at: '14:05', text: 'installed @acme/invoices 1.4.0 from registry' },
  { at: '14:09', text: 'secret STRIPE_KEY stored' },
  { at: '14:21', text: 'ops.acme.com verified · certificate issued' },
  { at: '14:22', text: 'nightly backup scheduled' },
]

export function CloudLifecycle() {
  return (
    <section className="border-console-line bg-console-bg/70 border-y">
      <Container className="flex flex-wrap items-center gap-12 py-24">
        <div className="min-w-0 flex-[1_1_360px]">
          <SectionHeading
            eyebrow="// from zero to production"
            title="An afternoon, not a project."
            lead="Everything below is a click in the console. No tickets, no YAML, no cluster to babysit."
          />
        </div>
        <ol className="border-console-line-strong bg-console-surface font-console-mono min-w-0 flex-[1_1_560px] overflow-x-auto rounded-2xl border p-5 text-sm leading-loose text-[#c5cdca]">
          {LOG.map((l) => (
            <li key={l.at + l.text} className="whitespace-nowrap">
              <span className="text-console-faint">{l.at}</span>{' '}
              <span className="text-console-signal">✓</span> {l.text}
              {l.strong ? (
                <>
                  {' '}
                  <b className="text-console-ink font-medium">{l.strong}</b> {l.rest}
                </>
              ) : null}
            </li>
          ))}
          <li className="whitespace-nowrap">
            <span className="text-console-faint">14:22</span>{' '}
            <span className="text-console-signal">→</span> team invited · signing in with Renown
            <span className="console-caret ml-1.5" aria-hidden />
          </li>
        </ol>
      </Container>
    </section>
  )
}
