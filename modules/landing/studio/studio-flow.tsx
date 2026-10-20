import { Container, SectionHeading } from '../components/section-heading'

const STEPS = [
  {
    name: 'brief',
    body: 'Describe the process, paste a spreadsheet, or point at an existing package.',
  },
  {
    name: 'plan',
    body: 'Studio proposes models and operations. You can stop or redirect it at any point.',
  },
  { name: 'build', body: 'Models, reducers, editors and tests, saved as it goes.' },
  { name: 'preview', body: 'Use the app live inside your studio while it is being built.' },
  { name: 'publish', body: 'Version it to the registry and roll it out to a Cloud environment.' },
]

export function StudioFlow() {
  return (
    <section className="border-console-line border-t">
      <Container className="flex flex-col gap-10 py-24">
        <SectionHeading title="How a session goes" />
        <ol className="border-console-line grid grid-cols-1 border-t sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.name} className="flex flex-col gap-2.5 py-6 pr-6">
              <span className="font-console-mono text-console-signal text-[13px]">
                0{i + 1} {s.name}
              </span>
              <span className="text-console-muted leading-relaxed">{s.body}</span>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
