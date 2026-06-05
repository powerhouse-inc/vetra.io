import Image from 'next/image'

import { DotLottiePlayer } from '@/shared/components/ui/dotlottie-player'
import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'

const features = [
  {
    title: 'AI you choose, infrastructure you own',
    description:
      'Drop in your own API key or run a local model entirely on your hardware. Vetra orchestrates your AI-ready platform: structured data, custom apps, real-time sync, history, user roles, and signatures. Everything is embedded from day one.',
    image: '/images/home/rapid-application-development.svg',
    priority: true,
  },
  {
    title: 'Local first. Syncs when you want it to.',
    description:
      "Every app and agent can run entirely on your machine. Changes sync in real time when you're connected, and merge cleanly when you're not. Offline isn't a fallback, it's the default to take your team and your data anywhere.",
    lottie: 'https://cdn.lottielab.com/l/E6XFYWdFhnNvBH.json',
  },
  {
    title: 'Build your niche. Keep it yours.',
    description:
      'The best platforms are specific, community-owned, and impossible to extract value from. Vetra gives you the infrastructure for that — open schemas, data sovereignty, no proprietary middleman between you and your users.',
    image: '/images/home/collaborative-infrastructure.svg',
  },
  {
    title: 'Self-hosted or we\'ll host it for you.',
    description:
      "Deploy on our cloud, your cloud, or a private node. The platform is 100% open source — inspect every line, fork it, modify it, contribute it back to the community. You're never dependent on our uptime or our roadmap.",
    image: '/images/home/feature-collaborative.svg',
  },
  {
    title: 'Every action signed. Every change traceable.',
    description:
      'Every operation — human or agent — is cryptographically signed and appended to an immutable log. Know exactly who did what, when, and why. Optionally anchor to a blockchain for external auditability.',
    image: '/images/home/web3-enabled.svg',
  },
]

export function FeatureShowcase() {
  return (
    <ScrollReveal stagger>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
        <h2 className="text-foreground mb-16 text-center text-4xl font-bold">
          Built to stay yours
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
                      className="h-auto w-full object-contain"
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
