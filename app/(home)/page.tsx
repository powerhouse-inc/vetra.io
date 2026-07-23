import { ArchitectureDiagram } from '@/modules/home/components/architecture-diagram'
import { AudienceCards } from '@/modules/home/components/audience-cards'
import { BusinessModel } from '@/modules/home/components/business-model'
import { CloudCta } from '@/modules/home/components/cloud-cta'
import { FaqSection } from '@/modules/home/components/faq-section'
import { FeatureShowcase } from '@/modules/home/components/feature-showcase'
import { Hero } from '@/modules/home/components/hero'
import { PackageCta } from '@/modules/home/components/package-cta'
import { PowerhouseStack } from '@/modules/home/components/powerhouse-stack'
import { SpecToScale } from '@/modules/home/components/spec-to-scale'
import { WaitlistSignup } from '@/modules/home/components/waitlist-signup'
import { WhyVetra } from '@/modules/home/components/why-vetra'
import { GridBackground } from '@/modules/shared/components/ui/grid-background'
import { verifySession } from '@/modules/shared/lib/renown-session'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Vetra | Work smarter, together.',
  description:
    'Vetra turns your ideas into working software through a simple chat interface. Your whole team stays in sync, and developers keep full control under the hood.',
}

export default async function HomePage() {
  // Signed-in visitors go straight to their dashboard (was HomeAuthedRedirect).
  const session = await verifySession()
  if (session) redirect('/user')

  return (
    <div className="relative pt-16">
      {/* Grid background for hero section */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="relative h-[600px]">
          {/* Grid without fade */}
          <GridBackground
            squareSize={30}
            strokeWidth={2}
            strokeColor="#04c161"
            topFadeDistance={0}
            topFadeIntensity={0}
            bottomFadeDistance={0}
            bottomFadeIntensity={0}
            leftFadeDistance={0}
            leftFadeIntensity={0}
            rightFadeDistance={0}
            rightFadeIntensity={0}
            className="absolute inset-0 opacity-15"
          />
          {/* CSS-based fade overlay */}
          <div className="from-background to-background absolute inset-0 bg-gradient-to-b via-transparent opacity-100"></div>
        </div>
      </div>
      <div className="relative z-10">
        <Hero />
      </div>
      <ArchitectureDiagram />
      <PackageCta />
      <WhyVetra />
      <BusinessModel />
      <AudienceCards />
      <FeatureShowcase />
      <CloudCta />
      <PowerhouseStack />
      <SpecToScale />
      <WaitlistSignup />
      <FaqSection />
    </div>
  )
}
