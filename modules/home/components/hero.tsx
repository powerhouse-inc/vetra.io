import Image from 'next/image'
import Link from 'next/link'
import { HeroTerminal } from '@/modules/home/components/hero-terminal'

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

        <div className="mx-auto grid max-w-4xl gap-4 text-left md:grid-cols-2">
          <div className="border-border bg-accent/30 flex flex-col gap-4 rounded-xl border p-6">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              Run it locally
            </p>
            <div className="flex flex-1 items-center">
              <div className="w-full">
                <HeroTerminal />
              </div>
            </div>
            <p className="text-foreground-70 text-sm leading-relaxed">
              One command spins up your own Vetra instance. Docker &amp; Kubernetes ready.
            </p>
          </div>

          <div className="border-border bg-accent/30 flex flex-col gap-4 rounded-xl border p-6">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              Try it hosted
            </p>
            <div className="flex flex-1 items-center gap-2">
              <Link
                href="/user"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold transition-colors"
              >
                <Image
                  src="/logos/vetra-icon-dark.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 object-contain"
                />
                <span className="text-lg font-bold whitespace-nowrap">Vetra Studio</span>
                <span className="text-primary-foreground/80 text-xs font-semibold tracking-wider uppercase">
                  AI Builder
                </span>
              </Link>
              <Link
                href="https://academy.vetra.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-accent text-foreground hover:bg-accent/80 inline-flex h-12 shrink-0 items-center rounded-lg px-4 text-sm font-semibold transition-colors"
              >
                Docs
              </Link>
            </div>
            <p className="text-foreground-70 text-sm leading-relaxed">
              Jump straight into Vetra Studio in the cloud. Nothing to install.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
