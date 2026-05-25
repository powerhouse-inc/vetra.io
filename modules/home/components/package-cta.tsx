import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/modules/shared/components/ui/button'
import { GridBackground } from '@/modules/shared/components/ui/grid-background'
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

export function PackageCta() {
  return (
    <ScrollReveal>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
      <div className="relative overflow-hidden rounded-xl p-10 text-center">
        {/* Grid background */}
        <div className="pointer-events-none absolute inset-0">
          <GridBackground
            squareSize={30}
            strokeWidth={1}
            strokeColor="#04c161"
            topFadeDistance={0}
            topFadeIntensity={0}
            bottomFadeDistance={0}
            bottomFadeIntensity={0}
            leftFadeDistance={0}
            leftFadeIntensity={0}
            rightFadeDistance={0}
            rightFadeIntensity={0}
            className="absolute inset-0 opacity-75"
          />
          {/* CSS-based fade overlay */}
          <div className="from-background to-background absolute inset-0 rounded-xl bg-gradient-to-b via-transparent opacity-100"></div>
        </div>
        <div className="relative z-10">
          <h2 className="text-foreground mb-4 text-2xl font-bold">
            Explore the Vetra Package Library
          </h2>
          <p className="text-foreground-70 mt-2 text-2xl transition-all duration-500 ease-out">
            Browse community-built packages, document models, and extensions <br /> ready to use in
            your projects.
          </p>
          <div className="mx-auto mb-8 max-w-5xl">
            <Image
              src="/images/home/package-library.png"
              alt="Vetra Package Library"
              width={1596}
              height={829}
              className="h-auto w-full"
            />
          </div>
          <Button asChild size="lg">
            <Link href="/packages">Browse Packages</Link>
          </Button>
        </div>
      </div>
    </section>
    </ScrollReveal>
  )
}
