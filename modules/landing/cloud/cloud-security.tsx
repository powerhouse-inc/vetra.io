import { Container } from '../components/section-heading'

const TODAY = [
  'isolated namespace per environment',
  'secrets in OpenBao, not config files',
  'every document change signed (Renown)',
  'backups you can download',
]
const NOT_YET = ['no formal certifications yet', 'no uptime SLA yet; we publish status instead']

function Panel({ title, items, warn }: { title: string; items: string[]; warn?: boolean }) {
  return (
    <div className="border-console-line-strong bg-console-surface font-console-mono min-w-0 flex-[1_1_420px] rounded-2xl border p-7 text-sm leading-loose text-[#c5cdca]">
      <h3 className={`text-sm font-normal ${warn ? 'text-console-warn' : 'text-console-signal'}`}>
        {title}
      </h3>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  )
}

export function CloudSecurity() {
  return (
    <section>
      <Container className="flex flex-col gap-8 pb-24">
        <h2 className="text-[clamp(26px,3.5vw,40px)] leading-tight font-bold tracking-[-0.035em]">
          Security, without the buzzwords
        </h2>
        <div className="flex flex-wrap gap-4">
          <Panel title="// what we do today" items={TODAY} />
          <Panel title="// not yet" items={NOT_YET} warn />
        </div>
      </Container>
    </section>
  )
}
