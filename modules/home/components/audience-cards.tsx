import { AnimatedVetraLogo } from '@/modules/shared/components/ui/animated-vetra-logo'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/shared/components/ui/card'
import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'

const audiences = [
  {
    title: 'Business teams',
    description:
      'Get your processes running on custom software your team actually enjoys using. You want a feature? You add it. No technical setup required.',
    animation: 'scale' as const,
  },
  {
    title: 'Managed service providers',
    description:
      'Deploy sovereign instances of the infrastructure for your clients and offer ongoing support. Get paid for keeping their systems running smoothly.',
    animation: 'movement' as const,
  },
  {
    title: 'Data & AI teams',
    description:
      'Bring your own AI models & keys to Vetra to work with structured, AI ready data from across your organization. No messy integrations.',
    animation: 'threeStep' as const,
  },
]

export function AudienceCards() {
  return (
    <ScrollReveal stagger>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
        <h2 className="text-foreground mb-4 text-center text-3xl font-bold">Who it&apos;s for</h2>
        <p className="text-foreground-70 mt-2 mb-8 text-center text-2xl transition-all duration-500 ease-out">
          Vetra works for everyone — no technical background needed.
        </p>

        <div className="grid gap-6 lg:grid-cols-3">
          {audiences.map((audience) => (
            <ScrollRevealItem key={audience.title}>
              <Card>
                <CardHeader className="p-4">
                  <div className="flex items-center gap-3">
                    <AnimatedVetraLogo size={32} variant={audience.animation} className="h-8 w-8" />
                    <CardTitle>{audience.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-foreground-70 text-sm leading-relaxed">
                    {audience.description}
                  </p>
                </CardContent>
              </Card>
            </ScrollRevealItem>
          ))}
        </div>
      </section>
    </ScrollReveal>
  )
}
