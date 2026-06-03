import { Clock, Database, MessageSquare, Shield, TrendingUp, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

type Benefit = { title: string; description: string; icon: LucideIcon }

const benefits: Benefit[] = [
  {
    title: 'Just describe it',
    description:
      'Tell Vetra what you need in plain language. It understands your intent and sets up the workflow.',
    icon: MessageSquare,
  },
  {
    title: 'Works in real time',
    description:
      'Everyone sees changes the moment they happen. No more stale spreadsheets or waiting to sync.',
    icon: Zap,
  },
  {
    title: 'Your data, your rules',
    description:
      'Your data lives where you choose — our cloud or your own servers. No lock-in, ever.',
    icon: Database,
  },
  {
    title: 'Always available',
    description: 'Works offline too. Changes sync automatically when you’re back online.',
    icon: Clock,
  },
  {
    title: 'Grows with you',
    description:
      'Start with a small team and scale to millions of users. Vetra handles the complexity.',
    icon: TrendingUp,
  },
  {
    title: 'Secure by default',
    description: 'Every action is logged and verifiable. Know who changed what, and when.',
    icon: Shield,
  },
]

export function FeaturesTabs() {
  return (
    <ScrollReveal>
      <section className="mx-auto max-w-screen-xl px-[74px] pt-8 pb-20">
        <div className="mb-12 text-center">
          <h2 className="text-foreground mb-2 text-3xl font-bold">
            The stack, not just the surface
          </h2>
          <p className="text-foreground-70 mt-2 text-2xl transition-all duration-500 ease-out">
            Powerful software that anyone on your team can use
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="border-border hover:bg-accent rounded-xl border p-6 transition-colors"
            >
              <benefit.icon className="text-primary mb-2 h-6 w-6" />
              <h3 className="text-foreground mb-2 text-base font-bold">{benefit.title}</h3>
              <p className="text-foreground-70 text-sm leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>
    </ScrollReveal>
  )
}
