import Image from 'next/image'

import { DotLottiePlayer } from '@/shared/components/ui/dotlottie-player'
import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'

const features = [
  {
    title: 'Build anything, fast',
    description:
      'Describe your workflow and Vetra sets it up automatically. Use ready-made templates or create something from scratch — your team can be up and running in minutes.',
    image: '/images/home/rapid-application-development.svg',
  },
  {
    title: 'Everyone stays in sync',
    description:
      'Updates appear for your whole team the moment they happen. Like a live conversation, not a file waiting to be saved.',
    lottie: 'https://cdn.lottielab.com/l/E6XFYWdFhnNvBH.json',
  },
  {
    title: 'Work together, naturally',
    description:
      'Leave comments, suggest changes, and review updates — just like editing a shared document. Everyone stays on the same page, effortlessly.',
    image: '/images/home/collaborative-infrastructure.svg',
  },
  {
    title: 'Grows with your organization',
    description:
      'Start small and scale to millions of users without switching platforms or rewriting anything. Vetra handles the hard parts automatically.',
    image: '/images/home/feature-collaborative.svg',
  },
  {
    title: 'Secure and verifiable',
    description:
      'Every action is recorded and tamper-proof. Know exactly who did what, and when — optionally backed by blockchain for extra trust.',
    image: '/images/home/web3-enabled.svg',
  },
]

export function FeatureShowcase() {
  return (
    <ScrollReveal stagger>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
        <h2 className="text-foreground mb-16 text-center text-3xl font-bold">
          See what your team can do
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
