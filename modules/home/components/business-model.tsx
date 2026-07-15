import Link from 'next/link'
import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'

const revenueStreams = [
  {
    title: 'Managed hosting',
    description:
      'Vetra Cloud runs and scales your instance for you: storage, backups, and upgrades handled. Same open-source code as self-hosting, with zero ops on your side.',
    cta: { label: 'Explore Vetra Cloud', href: '/cloud', external: false },
  },
  {
    title: 'Integration services',
    description:
      'BAI, our Business Analysis & Integrations team, helps you model your workflows, design document models, and connect Vetra to the systems you already run.',
    cta: {
      label: 'Get in touch with our integrators ↗',
      href: 'https://bai.powerhouse.io/',
      external: true,
    },
  },
]

export function BusinessModel() {
  return (
    <ScrollReveal stagger>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
        <ScrollRevealItem>
          <div className="mb-12 text-center">
            <h2 className="text-foreground mb-4 text-3xl font-bold">How we make money</h2>
            <p className="text-foreground-70 mt-2 text-2xl">
              The platform is free and open source.
              <br />
              We charge for the services around it.
            </p>
          </div>
        </ScrollRevealItem>

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {revenueStreams.map((stream) => (
            <ScrollRevealItem key={stream.title} className="h-full">
              <div className="border-border flex h-full flex-col rounded-xl border p-6">
                <h3 className="text-foreground mb-3 text-lg font-bold">{stream.title}</h3>
                <p className="text-foreground-70 mb-6 text-sm leading-relaxed">
                  {stream.description}
                </p>
                <div className="mt-auto">
                  <Link
                    href={stream.cta.href}
                    {...(stream.cta.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className="bg-accent text-foreground hover:bg-accent/80 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
                  >
                    {stream.cta.label}
                  </Link>
                </div>
              </div>
            </ScrollRevealItem>
          ))}
        </div>
      </section>
    </ScrollReveal>
  )
}
