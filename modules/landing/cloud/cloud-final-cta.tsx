import { CtaLink } from '../components/cta-link'
import { Container } from '../components/section-heading'
import { EARLY_ACCESS_HREF, REDEEM_HREF, WALKTHROUGH_URL } from '../lib/links'

export function CloudFinalCta() {
  return (
    <section>
      <Container className="flex flex-col gap-6 py-24">
        <h2 className="font-console-mono text-[clamp(22px,3vw,36px)] leading-snug font-normal">
          <span className="text-console-faint">~/vetra $ </span>
          <span className="text-console-signal">env create</span>
          <span className="console-caret ml-1" aria-hidden />
        </h2>
        <div className="flex flex-wrap gap-3">
          <CtaLink href={REDEEM_HREF} variant="primary">
            Redeem access code
          </CtaLink>
          <CtaLink href={EARLY_ACCESS_HREF}>Request access</CtaLink>
          <CtaLink href={WALKTHROUGH_URL}>Book a walkthrough</CtaLink>
        </div>
      </Container>
    </section>
  )
}
