import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { AnimatedVetraLogo } from '@/modules/shared/components/ui/animated-vetra-logo'

export function Hero() {
  return (
    <section className="relative bg-transparent px-[74px] py-20 text-center md:py-28">
      <div className="relative mx-auto max-w-screen-xl">
        <h1 className="mx-auto mb-6 max-w-3xl text-[clamp(40px,5vw,64px)] leading-[1.1] font-bold tracking-tight">
          AI-native infrastructure
          <br />
          you actually own.
        </h1>

        <p className="text-foreground-70 mx-auto mb-10 max-w-2xl text-lg leading-relaxed">
          Vetra is an open-source application platform: structure your data as document models, get
          instant APIs, and let your whole team build &amp; deploy wherever you choose.
        </p>

        <div className="mb-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/user"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-lg px-8 py-3.5 text-base font-semibold transition-colors"
          >
            Vetra Studio
          </Link>
          <Link
            href="https://academy.vetra.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent text-foreground hover:bg-accent/80 inline-flex h-10 items-center rounded-lg px-8 py-3.5 text-base font-semibold transition-colors"
          >
            See how it works
          </Link>
        </div>

        <div className="flex justify-center">
          <Link
            href="#architecture"
            className="text-foreground-70 hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <AnimatedVetraLogo size={20} variant="threeStep" />
            For developers — see the architecture
            <ChevronDown className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
