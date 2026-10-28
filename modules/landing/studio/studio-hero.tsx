import { CtaLink } from '../components/cta-link'
import { PromptLine } from '../components/prompt-line'
import { Container } from '../components/section-heading'
import { EARLY_ACCESS_HREF, REDEEM_HREF } from '../lib/links'

export function StudioHero() {
  return (
    <section>
      <Container className="flex flex-col gap-7 pt-16 pb-12 sm:pt-20">
        <PromptLine>studio --open</PromptLine>
        <p className="font-console-mono text-console-warn border-console-warn/40 self-start rounded-full border px-3 py-1 text-xs">
          early access · pre-alpha
        </p>
        <h1 className="max-w-[1100px] text-[clamp(40px,6.5vw,84px)] leading-none font-bold tracking-[-0.045em]">
          A studio of your own, with an agent that builds alongside you.
        </h1>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <p className="text-console-muted max-w-[660px] text-lg leading-relaxed sm:text-xl">
            Vetra Studio turns a conversation into a working Powerhouse package: document models,
            editors, APIs and tests. You steer every step and keep every line.
          </p>
          <div className="flex flex-wrap gap-3">
            <CtaLink href={EARLY_ACCESS_HREF} variant="primary">
              Request access
            </CtaLink>
            <CtaLink href={REDEEM_HREF}>Redeem a code</CtaLink>
          </div>
        </div>
      </Container>
    </section>
  )
}
