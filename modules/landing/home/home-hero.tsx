import { CtaLink } from '../components/cta-link'
import { InstallChip } from '../components/install-chip'
import { PromptLine } from '../components/prompt-line'
import { Container } from '../components/section-heading'
import { EARLY_ACCESS_HREF } from '../lib/links'

export function HomeHero() {
  return (
    <section>
      <Container className="flex flex-col gap-7 pt-16 pb-12 sm:pt-20">
        <PromptLine>what-is</PromptLine>
        <h1 className="max-w-[1100px] text-[clamp(40px,6.5vw,88px)] leading-none font-bold tracking-[-0.045em]">
          An agent that builds Powerhouse apps. A cloud that hosts them.
        </h1>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <p className="text-console-muted max-w-[620px] text-lg leading-relaxed sm:text-xl">
            Studio writes an open-source package. Vetra Cloud hosts it for you, or you self-host it
            on the open Powerhouse platform.
          </p>
          <div className="flex max-w-full min-w-0 flex-wrap gap-3">
            <CtaLink href={EARLY_ACCESS_HREF} variant="primary">
              Get early access
            </CtaLink>
            <InstallChip />
          </div>
        </div>
      </Container>
    </section>
  )
}
