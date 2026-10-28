import { WAITLIST_ACTION } from '@/modules/studio-license/lib/waitlist'
import { CtaLink } from '../components/cta-link'
import { InstallChip } from '../components/install-chip'
import { Container } from '../components/section-heading'
import { REDEEM_HREF, RUN_LOCALLY_URL } from '../lib/links'

export function StudioAccess() {
  return (
    <section id="access" className="border-console-line scroll-mt-20 border-t">
      <Container className="flex flex-col gap-10 py-24">
        <h2 className="font-console-mono text-[clamp(22px,3vw,36px)] leading-snug font-normal">
          <span className="text-console-faint">~/vetra $ </span>
          <span className="text-console-signal">join --early-access</span>
          <span className="console-caret ml-1" aria-hidden />
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="border-console-line-strong bg-console-surface flex flex-col gap-4 rounded-2xl border p-6">
            <h3 className="text-lg font-semibold">Request access</h3>
            <p className="text-console-muted text-sm leading-relaxed">
              We open access in small groups and send a code when a spot frees up.
            </p>
            <form
              action={WAITLIST_ACTION}
              method="post"
              target="_blank"
              className="mt-auto flex flex-wrap gap-2"
            >
              <input
                type="email"
                name="EMAIL"
                required
                aria-label="Email to request access"
                placeholder="you@example.com"
                className="border-console-line-strong bg-console-bg text-console-ink placeholder:text-console-faint focus:ring-console-signal/40 min-h-12 min-w-0 flex-1 rounded-lg border px-3 text-[15px] focus:ring-2 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-console-signal text-console-bg min-h-12 rounded-lg px-5 text-[15px] font-semibold"
              >
                Request access
              </button>
            </form>
          </div>
          <div className="border-console-line-strong bg-console-surface flex flex-col gap-4 rounded-2xl border p-6">
            <h3 className="text-lg font-semibold">Have a code?</h3>
            <p className="text-console-muted text-sm leading-relaxed">
              Redeem it and your studio is provisioned right away.
            </p>
            <CtaLink href={REDEEM_HREF} variant="primary" className="mt-auto self-start">
              Redeem a code
            </CtaLink>
          </div>
          <div className="border-console-line-strong bg-console-surface flex flex-col gap-4 rounded-2xl border p-6">
            <h3 className="text-lg font-semibold">Run it locally</h3>
            <p className="text-console-muted text-sm leading-relaxed">
              No waiting: install Vetra and run Studio on your own machine.{' '}
              <a
                href={RUN_LOCALLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-console-signal underline-offset-4 hover:underline"
              >
                Guide ↗
              </a>
            </p>
            <div className="mt-auto">
              <InstallChip />
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
