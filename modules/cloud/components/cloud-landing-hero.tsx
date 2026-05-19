import Link from 'next/link'
import { IsoGrid } from '@/modules/shared/components/ui/iso-grid'
import { CreatePackageModal } from '@/app/packages/components/create-package-modal'

export function CloudLandingHero() {
  return (
    <section className="relative overflow-hidden px-6 py-20 text-center md:py-28">
      <IsoGrid />
      <div className="relative z-10 mx-auto max-w-screen-xl">
        <p className="text-primary mb-4 text-sm font-semibold">Your cloud, your way.</p>
        <h1 className="mx-auto mb-4 max-w-2xl text-[clamp(28px,4vw,48px)] leading-[1.1] font-bold">
          Independent infrastructure{' '}
          <span className="text-primary">for independent organizations</span>
        </h1>
        <p className="text-foreground-70 mx-auto mb-8 max-w-xl text-base leading-relaxed">
          Combine the scalability and convenience of centralized cloud providers with the freedom to
          move your data anytime.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <CreatePackageModal />
          <Link
            href="#features"
            className="bg-accent text-foreground hover:bg-accent/80 rounded-lg px-8 py-3 text-sm font-semibold transition-colors"
          >
            Learn More
          </Link>
        </div>
      </div>
    </section>
  )
}
