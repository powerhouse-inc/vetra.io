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
    tag: 'restore',
    title: 'Restore in a few clicks',
    body: 'Roll an environment back to any backup. A safety dump is taken first, so nothing is lost.',
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
        {/* A table from sm up; below that each add-on stacks (name and plan, then the description). */}
        <div className="border-console-line-strong bg-console-surface rounded-2xl border">
          <table className="block w-full border-collapse text-[15px] sm:table">
            <thead className="hidden sm:table-header-group">
              <tr className="font-console-mono text-console-faint text-left text-xs">
                <th className="px-5 py-3.5 font-medium">add-on</th>
                <th className="px-5 py-3.5 font-medium">what it does</th>
                <th className="px-5 py-3.5 text-right font-medium">plan</th>
              </tr>
            </thead>
            <tbody className="block sm:table-row-group">
              {ADDONS.map((a) => (
                <tr
                  key={a.name}
                  className="border-console-line grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t px-5 py-4 first:border-t-0 sm:table-row sm:p-0 sm:first:border-t"
                >
                  <th
                    scope="row"
                    className="font-console-mono text-left font-normal sm:px-5 sm:py-4"
                  >
                    {a.name}
                  </th>
                  <td className="text-console-muted col-span-2 row-start-2 sm:px-5 sm:py-4">
                    {a.body}
                  </td>
                  <td className="text-right sm:px-5 sm:py-4">
                    <span
                      className={`font-console-mono rounded-full px-2.5 py-1 text-xs whitespace-nowrap ${a.included ? 'bg-console-signal/10 text-console-signal' : 'border-console-line-strong text-console-muted border'}`}
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
