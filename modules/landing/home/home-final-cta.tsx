import { CtaLink } from '../components/cta-link'
import { Container } from '../components/section-heading'
import { DISCORD_URL, EARLY_ACCESS_HREF, REDEEM_HREF } from '../lib/links'

export function HomeFinalCta() {
  return (
    <section className="border-console-line border-t">
      <Container className="flex flex-col gap-6 py-24">
        <h2 className="font-console-mono text-[clamp(22px,3vw,36px)] leading-snug font-normal">
          <span className="text-console-faint">~/vetra $ </span>
          <span className="text-console-signal">join --early-access</span>
          <span className="console-caret ml-1" aria-hidden />
        </h2>
        <div className="flex flex-wrap gap-3">
          <CtaLink href={EARLY_ACCESS_HREF} variant="primary">
            Request access
          </CtaLink>
          <CtaLink href={REDEEM_HREF}>Redeem a code</CtaLink>
          <CtaLink href={DISCORD_URL}>Join Discord</CtaLink>
        </div>
      </Container>
    </section>
  )
}
