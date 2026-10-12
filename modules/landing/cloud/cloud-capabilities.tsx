import { Container, SectionHeading } from '../components/section-heading'

const CAPABILITIES = [
  {
    tag: 'domains',
    title: 'Bring your domain',
    body: 'An instant subdomain on day one. Add two DNS records for your own; certificates are automatic.',
  },
  {
    tag: 'packages',
    title: 'Install from the registry',
    body: 'Packages from Studio or your CI. Pin a version or let it update.',
  },
  {
    tag: 'secrets',
    title: 'Secrets in a vault',
    body: 'Stored in OpenBao, injected at start, never shown twice.',
  },
  {
    tag: 'backups',
    title: 'Backups you can download',
    body: 'Nightly by default. Restore here, or on your own setup.',
  },
  {
    tag: 'logs · metrics',
    title: 'See what is happening',
    body: 'Per-service logs and resource graphs in the console.',
  },
  {
    tag: 'database',
    title: 'Look inside your data',
    body: 'A database explorer, right in the browser.',
  },
]

const ADDONS = [
  { name: 'agent', body: 'Automations with their own signed identity', included: true },
  { name: 'docling', body: 'PDFs and scans into structured data', included: false },
  { name: 'paperless', body: 'A searchable archive for incoming documents', included: false },
  { name: 'speckle', body: '3D and building data, linked to your models', included: false },
]

export function CloudCapabilities() {
  return (
    <section>
      <Container className="flex flex-col gap-10 py-24">
        <SectionHeading title="Day two, handled" />
        <ul className="bg-console-line border-console-line grid grid-cols-1 gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <li key={c.tag} className="bg-console-surface flex flex-col gap-2.5 p-7">
              <code className="font-console-mono text-console-signal text-sm">{c.tag}</code>
              <h3 className="text-xl font-semibold">{c.title}</h3>
              <p className="text-console-muted leading-relaxed">{c.body}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-[clamp(26px,3.5vw,40px)] leading-tight font-bold tracking-[-0.035em]">
          Add-ons, one switch each
        </h3>
        <div className="border-console-line-strong bg-console-surface overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[560px] border-collapse text-[15px]">
            <thead>
              <tr className="font-console-mono text-console-faint text-left text-xs">
                <th className="px-5 py-3.5 font-medium">add-on</th>
                <th className="px-5 py-3.5 font-medium">what it does</th>
                <th className="px-5 py-3.5 text-right font-medium">plan</th>
              </tr>
            </thead>
            <tbody>
              {ADDONS.map((a) => (
                <tr key={a.name} className="border-console-line border-t">
                  <td className="font-console-mono px-5 py-4">{a.name}</td>
                  <td className="text-console-muted px-5 py-4">{a.body}</td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className={`font-console-mono rounded-full px-2.5 py-1 text-xs ${a.included ? 'bg-console-signal/10 text-console-signal' : 'border-console-line-strong text-console-muted border'}`}
                    >
                      {a.included ? 'included' : 'optional'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  )
}
