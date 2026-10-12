import { Container, SectionHeading } from '../components/section-heading'

const OUTPUTS = [
  {
    tag: 'document-models',
    title: 'Document models',
    body: 'Typed state and named operations with a complete, replayable history.',
  },
  {
    tag: 'editors',
    title: 'Editors',
    body: 'React interfaces your team uses in Connect.',
  },
  {
    tag: 'subgraphs',
    title: 'APIs',
    body: 'GraphQL subgraphs served by Switchboard, ready for other systems.',
  },
  {
    tag: 'processors',
    title: 'Processors',
    body: 'Background logic that reacts to changes, from reminders to reports.',
  },
]

export function StudioOutputs() {
  return (
    <section>
      <Container className="flex flex-col gap-10 pb-24">
        <SectionHeading
          title="Real building blocks, not a demo"
          lead="Studio writes the same parts a Powerhouse developer would, as an open-source package your team can pick up where it stopped."
        />
        <ul className="bg-console-line border-console-line grid grid-cols-1 gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-4">
          {OUTPUTS.map((o) => (
            <li key={o.tag} className="bg-console-surface flex flex-col gap-2.5 p-7">
              <code className="font-console-mono text-console-signal text-sm">{o.tag}</code>
              <h3 className="text-xl font-semibold">{o.title}</h3>
              <p className="text-console-muted leading-relaxed">{o.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
