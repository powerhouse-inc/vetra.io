import Link from 'next/link'

import { Button } from '@/modules/shared/components/ui/button'
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

export function SpecToScale() {
  return (
    <ScrollReveal>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
      <div className="mb-10 text-center">
        <p className="text-foreground text-3xl font-bold">Ready to get started?</p>
        <p className="text-foreground-70 mt-2 text-2xl transition-all duration-500 ease-out">
          Join teams already building with Vetra
        </p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button asChild size="lg">
          <Link href="/cloud">Explore Vetra Cloud</Link>
        </Button>
        <Button asChild size="lg">
          <Link href="https://academy.vetra.io/">Explore Vetra Academy</Link>
        </Button>
      </div>
    </section>
    </ScrollReveal>
  )
}
