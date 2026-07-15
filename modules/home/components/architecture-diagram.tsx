import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'

const layers = [
  {
    role: 'Client layer',
    name: 'Vetra Studio & Connect',
    description:
      'Local-first apps and a builder studio your whole team works in — online or offline.',
    features: [
      'Local-first, P2P sync, works offline',
      'Specification Driven AI',
      'Team collaboration built in',
      'TypeScript + React SDK',
    ],
  },
  {
    role: 'Data layer',
    name: 'Document Models',
    description:
      'Your data structured from day one, in an open format that AI and integrations can rely on.',
    features: [
      'Structured AI-ready data format',
      'Git-like version history',
      'Role-based permissions',
    ],
  },
  {
    role: 'API layer',
    name: 'Switchboard',
    description:
      'Every document model instantly exposed as an API — for your apps, agents, and integrations.',
    features: [
      'Data instantly as GraphQL API',
      'REST + WebSocket support',
      'Real-time event streaming',
      'Blockchain & Web3 support',
    ],
  },
]

const deployFacts = [
  'Self-hosted, Vetra Cloud, or hybrid',
  'Docker + Kubernetes ready',
  '100% open source (+ proprietary extensions)',
]

function LayerCard({ layer }: { layer: (typeof layers)[number] }) {
  return (
    <div className="border-border bg-accent/30 flex h-full flex-col rounded-xl border p-6 text-left">
      <p className="text-primary mb-1 text-xs font-semibold tracking-wider uppercase">
        {layer.role}
      </p>
      <h3 className="text-foreground mb-2 text-lg font-bold">{layer.name}</h3>
      <p className="text-foreground-70 mb-4 text-sm leading-relaxed">{layer.description}</p>
      <ul className="mt-auto flex flex-col gap-1.5">
        {layer.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <span className="text-primary font-bold">✓</span>
            <span className="text-foreground-70">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FlowArrow() {
  return (
    <div
      aria-hidden="true"
      className="text-primary flex items-center justify-center text-2xl font-bold"
    >
      <span className="hidden md:block">→</span>
      <span className="md:hidden">↓</span>
    </div>
  )
}

export function ArchitectureDiagram() {
  return (
    <ScrollReveal stagger>
      <section id="architecture" className="mx-auto max-w-screen-xl scroll-mt-24 px-6 py-20">
        <ScrollRevealItem>
          <div className="mb-12 text-center">
            <h2 className="text-foreground mb-4 text-3xl font-bold">How Vetra works</h2>
            <p className="text-foreground-70 mt-2 text-xl">
              From structured documents to production APIs — three layers,
              <br />
              all open source, all yours to run.
            </p>
          </div>
        </ScrollRevealItem>

        <ScrollRevealItem>
          <div className="border-primary/40 relative rounded-2xl border-2 border-dashed p-6 pt-8 md:p-8 md:pt-10">
            <span className="bg-background text-primary absolute -top-3 left-1/2 -translate-x-1/2 px-3 text-xs font-semibold tracking-wider whitespace-nowrap uppercase">
              Runs on your infrastructure
            </span>
            <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <LayerCard layer={layers[0]} />
              <FlowArrow />
              <LayerCard layer={layers[1]} />
              <FlowArrow />
              <LayerCard layer={layers[2]} />
            </div>
          </div>
        </ScrollRevealItem>

        <ScrollRevealItem>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <span className="text-foreground font-semibold">Deploy it your way:</span>
            {deployFacts.map((fact) => (
              <span key={fact} className="flex items-center gap-2">
                <span className="text-primary font-bold">✓</span>
                <span className="text-foreground-70">{fact}</span>
              </span>
            ))}
          </div>
        </ScrollRevealItem>
      </section>
    </ScrollReveal>
  )
}
