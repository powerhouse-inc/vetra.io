import { CapacityPicker } from '../components/capacity-picker'
import { Container } from '../components/section-heading'
import { WALKTHROUGH_URL } from '../lib/links'
import { tierFor } from '../lib/pricing'

const EXAMPLE = tierFor(2)

export function CloudPricing() {
  return (
    <section id="pricing" className="border-console-line border-t">
      <Container className="flex flex-col gap-8 py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-3xl flex-col gap-4">
            <h2 className="text-[clamp(30px,4vw,52px)] leading-[1.02] font-bold tracking-[-0.04em]">
              Pay for capacity.{' '}
              <span className="text-console-faint">Your packages decide how much.</span>
            </h2>
            <p className="text-console-muted text-lg leading-relaxed">
              Every environment runs on a resource bundle. The solution and the packages you install
              determine the size you need, and the price scales linearly with it.
            </p>
          </div>
          <p className="font-console-mono text-console-faint text-[13px]">
            {'// beta: access by invite code'}
          </p>
        </div>
        <div className="flex flex-wrap items-stretch gap-4">
          <div className="min-w-0 flex-[1_1_460px]">
            <CapacityPicker />
          </div>
          <div className="border-console-line-strong bg-console-surface flex min-w-0 flex-[1_1_460px] flex-col overflow-hidden rounded-2xl border">
            <p className="border-console-line font-console-mono text-console-faint border-b px-4 py-2.5 text-xs">
              sized from what you install
            </p>
            <pre className="font-console-mono m-0 flex-1 overflow-x-auto p-5 text-[13px] leading-loose text-[#c5cdca]">
              <span className="text-console-signal">$</span> plan invoice-approval + docling
              {'\n\n'}
              {'  '}
              <span className="text-console-faint">solution</span>
              {'\n  connect · switchboard · fusion\n  @acme/invoices\n  '}
              <span className="text-console-faint">add-ons</span>
              {'\n  docling\n  '}
              <span className="text-console-faint">────────────────────────────────</span>
              {'\n  '}
              <span className="text-console-signal">→ recommended</span>
              {`  ${EXAMPLE.vcpu} vCPU · ${EXAMPLE.memoryGb} GB · ${EXAMPLE.nvmeGb} GB`}
              {'\n                   '}
              <span className="text-console-ink">€{EXAMPLE.eurPerMonth} / month</span>
            </pre>
            <p className="border-console-line text-console-muted border-t px-4 py-3.5 text-sm">
              Add-ons and heavier packages need more capacity. Scale up or down whenever your setup
              changes.
            </p>
          </div>
        </div>
        <p className="text-console-faint text-sm">
          Need dedicated nodes or more than 16 vCPU?{' '}
          <a
            href={WALKTHROUGH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-console-signal underline-offset-4 hover:underline"
          >
            Talk to us
          </a>
          .
        </p>
      </Container>
    </section>
  )
}
