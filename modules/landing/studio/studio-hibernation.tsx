import { Container, SectionHeading } from '../components/section-heading'

const STATES = [
  { label: 'Hibernating', note: 'no compute used', dot: 'bg-console-faint', active: false },
  { label: 'Waking your studio…', note: 'a few seconds', dot: 'bg-console-warn', active: false },
  { label: 'Awake', note: 'session restored', dot: 'bg-console-signal', active: true },
]

export function StudioHibernation() {
  return (
    <section className="border-console-line bg-console-bg/70 border-y">
      <Container className="flex flex-wrap items-center gap-12 py-24">
        <div className="min-w-0 flex-[1_1_400px]">
          <SectionHeading
            eyebrow="// your studio, not a shared sandbox"
            title="It sleeps when you do"
            lead="Each studio is an isolated environment with its own workspace and repository. It hibernates when you step away and wakes, with your session intact, when you come back."
          />
        </div>
        <ul className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
          {STATES.map((s) => (
            <li
              key={s.label}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 ${s.active ? 'border-console-signal bg-console-signal/5' : 'border-console-line-strong'}`}
            >
              <span className="flex items-center gap-3">
                <span className={`size-2.5 rounded-full ${s.dot}`} aria-hidden />
                {s.label}
              </span>
              <span
                className={`font-console-mono text-[13px] ${s.active ? 'text-console-signal' : 'text-console-faint'}`}
              >
                {s.note}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
