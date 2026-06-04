import Image from 'next/image'

import { DotLottiePlayer } from '@/shared/components/ui/dotlottie-player'
import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'

const features = [
  {
    title: 'AI you choose, infrastructure you own',
    description:
      'Drop in your own API key or run a local model entirely on your hardware. Vetra orchestrates it — you keep full control over which AI touches which data.',
    image: '/images/home/rapid-application-development.png',
    priority: true,
  },
  {
    title: 'Local first. Syncs when you want it to.',
    description:
      "Every app and agent runs entirely on your machine — no cloud required. Changes sync in real time when you're connected, and merge cleanly when you're not. Offline isn't a fallback — it's the default.",
    lottie: 'https://cdn.lottielab.com/l/E6XFYWdFhnNvBH.json',
  },
  {
    title: 'Your data never leaves without permission',
    description:
      'Every document, event, and agent output is stored in a format you own — JSON schemas you define, on infrastructure you control. Not a proprietary blob on our servers.',
    image: '/images/home/collaborative-infrastructure.png',
  },
  {
    title: 'Yours to run. Ours to help you with.',
    description:
      "Deploy on our cloud, your cloud, or a private node. The platform is 100% open source — inspect every line, fork it, modify it, move it. You're never dependent on our uptime or our roadmap.",
    image: '/images/home/feature-collaborative.svg',
  },
  {
    title: 'Every action signed. Every change traceable.',
    description:
      'Every operation — human or agent — is cryptographically signed and appended to an immutable log. Know exactly who did what, when, and why. Optionally anchor to a blockchain for external auditability.',
    image: '/images/home/web3-enabled.png',
  },
]

export function FeatureShowcase() {
  return (
    <ScrollReveal stagger>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
        <h2 className="text-foreground mb-16 text-center text-3xl font-bold">
          What you own when you build on Vetra
        </h2>

        <div className="space-y-20">
          {features.map((feature, i) => (
            <ScrollRevealItem key={feature.title}>
              <div
                className={`flex flex-col items-center gap-10 md:flex-row ${
                  i % 2 === 0 ? 'md:flex-row-reverse' : ''
                }`}
              >
                <div className="flex-1">
                  <h3 className="text-foreground mb-4 text-2xl font-bold">{feature.title}</h3>
                  <p className="text-foreground-70 leading-relaxed">{feature.description}</p>
                </div>
                <div className="flex-1 overflow-hidden rounded-xl">
                  {'lottie' in feature && feature.lottie ? (
                    <DotLottiePlayer src={feature.lottie} className="h-[400px] w-full" />
                  ) : feature.image ? (
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      width={600}
                      height={400}
                      sizes="(min-width: 768px) 50vw, 100vw"
                      priority={'priority' in feature && feature.priority}
                      className="h-auto w-full object-cover"
                    />
                  ) : null}
                </div>
              </div>
            </ScrollRevealItem>
          ))}
        </div>
      </section>
    </ScrollReveal>
  )
}
