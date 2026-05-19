import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/modules/shared/components/ui/button'

export function CloudCta() {
  return (
    <section className="mx-auto max-w-screen-xl px-6 py-20">
      <div className="flex flex-col items-center gap-10 md:flex-row">
        <div className="flex-1">
          <h2 className="text-foreground mb-4 text-3xl font-bold">Launch your apps, your way</h2>
          <p className="text-foreground-70 mb-1 max-w-lg leading-relaxed">
            Vetra Cloud keeps your workflows running — no servers to manage. Or run everything on
            your own infrastructure.
          </p>
          <p className="text-foreground mb-6 font-semibold">Your software. Your data. Your call.</p>
          <Button asChild size="lg">
            <Link href="/cloud">Explore Vetra Cloud</Link>
          </Button>
        </div>
        <div className="flex-1">
          <Image
            src="/images/home/cloud-preview.svg"
            alt="Vetra Cloud"
            width={600}
            height={400}
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  )
}
