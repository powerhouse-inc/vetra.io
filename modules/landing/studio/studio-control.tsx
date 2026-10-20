import { Container, SectionHeading } from '../components/section-heading'

const POINTS = [
  { title: 'Plans before code', body: 'Studio explains what it will build before it builds it.' },
  { title: 'Your work is saved', body: 'Download your workspace any time; GitHub sync arrives with publishing.' },
  {
    title: 'Signed with your identity',
    body: 'Sign in with Renown. Every change carries your signature.',
  },
  {
    title: 'Models included',
    body: 'Runs on Claude through OpenRouter. Your licence includes a monthly model budget.',
  },
]

const STATUS = [
  {
    title: '// works today',
    tone: 'text-console-signal',
    items: [
      'Models, editors and subgraphs from a conversation',
      'Live preview',
      'Publish to the registry',
    ],
  },
  {
    title: '// still rough',
    tone: 'text-console-warn',
    items: ['Large refactors', 'Major version upgrades may need a re-run; keep an export of important work'],
  },
]

export function StudioControl() {
  return (
    <section>
      <Container className="flex flex-col gap-10 py-24">
        <SectionHeading title="You stay in charge" />
        <ul className="border-console-line grid grid-cols-1 border-t sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p) => (
            <li key={p.title} className="flex flex-col gap-2 py-6 pr-6">
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="text-console-muted leading-relaxed">{p.body}</p>
            </li>
          ))}
        </ul>
        <div className="border-console-line-strong bg-console-surface flex flex-col gap-6 rounded-2xl border p-7">
          <h2 className="text-[clamp(24px,3vw,34px)] font-bold tracking-[-0.03em]">
            Where Studio is today
          </h2>
          <div className="flex flex-wrap gap-8">
            {STATUS.map((s) => (
              <div key={s.title} className="font-console-mono min-w-0 flex-[1_1_280px] text-sm">
                <h3 className={`${s.tone} font-normal`}>{s.title}</h3>
                <ul className="mt-2 leading-loose text-[#c5cdca]">
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
