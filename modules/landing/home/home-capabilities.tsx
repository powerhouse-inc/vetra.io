import { Container, SectionHeading } from '../components/section-heading'

const CAPABILITIES = [
  {
    tag: 'studio',
    title: 'A private studio in seconds',
    body: 'Your own studio, ready in seconds. It hibernates when idle and wakes when you return.',
  },
  {
    tag: 'environments',
    title: 'Environments with a name',
    body: 'An instant subdomain, or point your own domain with two DNS records.',
  },
  {
    tag: 'registry',
    title: 'A registry built in',
    body: 'Publish from Studio, install on any environment, pin a version or let it update.',
  },
  {
    tag: 'git push',
    title: 'Deploy from your repo',
    body: 'A GitHub Action builds and rolls out on every merge.',
  },
  {
    tag: 'logs · metrics',
    title: 'See what is happening',
    body: 'Per-service logs and resource graphs without leaving the console.',
  },
  {
    tag: 'backups',
    title: 'Leave with everything',
    body: 'Backups and packages are yours. Restore them on any self-hosted Powerhouse setup.',
  },
]

export function HomeCapabilities() {
  return (
    <section className="border-console-line border-t">
      <Container className="flex flex-col gap-10 py-24">
        <SectionHeading title="Everything you need, in one console" />
        <ul className="bg-console-line border-console-line grid grid-cols-1 gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <li key={c.tag} className="bg-console-surface flex flex-col gap-2.5 p-7">
              <code className="font-console-mono text-console-signal text-sm">{c.tag}</code>
              <h3 className="text-xl font-semibold">{c.title}</h3>
              <p className="text-console-muted leading-relaxed">{c.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
