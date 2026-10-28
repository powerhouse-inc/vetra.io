import { CtaLink } from '../components/cta-link'
import { PromptLine } from '../components/prompt-line'
import { Container } from '../components/section-heading'
import { REDEEM_HREF, WALKTHROUGH_URL } from '../lib/links'

export function CloudHero() {
  return (
    <section>
      <Container className="flex flex-col gap-7 pt-16 pb-12 sm:pt-20">
        <PromptLine>cloud --help</PromptLine>
        <h1 className="max-w-[1100px] text-[clamp(40px,6.5vw,88px)] leading-none font-bold tracking-[-0.045em]">
          Managed hosting for Powerhouse apps.{' '}
          <span className="text-console-faint">Without the lock-in.</span>
        </h1>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <p className="text-console-muted max-w-[640px] text-lg leading-relaxed sm:text-xl">
            Environments with a team workspace, APIs and agents. Your domain, your packages, nightly
            backups. We operate it; your app stays on the open Powerhouse platform, so self-hosting
            is always an option.
          </p>
          <div className="flex flex-wrap gap-3">
            <CtaLink href={REDEEM_HREF} variant="primary">
              Redeem a code
            </CtaLink>
            <CtaLink href={WALKTHROUGH_URL}>Book a walkthrough</CtaLink>
          </div>
        </div>
        <p className="font-console-mono text-console-faint text-[13px]">
          <span className="text-console-warn">●</span> beta · invite only
        </p>
      </Container>
    </section>
  )
}
