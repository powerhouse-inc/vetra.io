'use client'

import { Boxes, Loader2, Moon, PlugZap } from 'lucide-react'
import { studioAppsEnabled } from '@/modules/cloud/switchboard-url'
import type { StudioProduct } from '../use-studio-products'
import { MakeAppDialog } from './make-app-dialog'
import { useStudioLlmStatus } from '../use-studio-llm-status'
import { useStudioLlmUsage } from '../use-studio-llm-usage'

const usd = (n: number) => `$${n.toFixed(2)}`

/**
 * A product in the grid.
 *  - ready → links straight to the studio URL in a new tab.
 *  - sleeping (housekeeping-hibernated) → also a link: opening the host hits the
 *    wake activator, which redirects to the branded /studio/waking page that
 *    wakes it and opens it when ready. So the card just opens the host; it
 *    carries a 💤 badge so the resting state is visible.
 *  - booting → inert with a "Provisioning…" pill.
 *
 * Brand metadata is cached server-side (myStudioProducts → obsDB) so the card
 * shows the real product name even while hibernated, with no per-card host fetch.
 */
export function StudioProductCard({
  product,
  href,
  locked = false,
}: {
  product: StudioProduct
  href: string
  /** No live Studio licence: the card stays listed but offers no actions. */
  locked?: boolean
}) {
  const isReady = product.status === 'ready'
  const isSleeping = product.status === 'sleeping'
  // Both ready and sleeping open the host; sleeping flows through the activator
  // → /studio/waking spinner, ready lands directly in the studio.
  const canOpen = isReady || isSleeping

  // A Studio that is up but has no model key answers "No model is connected…":
  // say so on the card. Not asked while booting, or for a locked (lapsed) card.
  const llm = useStudioLlmStatus(product.envId, canOpen && !locked)
  const needsModel = llm.data?.connected === false

  // The monthly budget, quiet when unknown: no usage or a failed fetch shows nothing.
  const usage = useStudioLlmUsage(product.envId, canOpen && !locked && !needsModel).data
  const budget = !usage
    ? null
    : usage.limitUsd != null && usage.usageUsd >= usage.limitUsd
      ? 'Budget used up'
      : usage.limitUsd != null
        ? `${usd(usage.usageUsd)} of ${usd(usage.limitUsd)}`
        : `${usd(usage.usageUsd)} used`

  // Cached brand from the switchboard; falls back to the env label when absent.
  const brand = product.brand
  const title = brand?.title?.trim() || product.label || 'Untitled product'

  const cardClass = `border-border bg-card flex flex-col rounded-xl border p-5 ${
    canOpen ? 'hover:border-foreground/30 transition-colors' : 'cursor-default opacity-80'
  }`

  const statusBadge = isReady ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
      Ready
    </span>
  ) : isSleeping ? (
    // Hibernated to save resources. Clicking opens it (a spinner wakes it,
    // ~1-2 min). Communicate that it's intentional + resumable, not broken.
    <span
      title="This studio is asleep to save resources. Click to wake it — it opens when ready."
      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-500"
    >
      <Moon className="h-3 w-3" aria-hidden />
      Sleeping
    </span>
  ) : (
    // Still booting: the agent host isn't reachable yet (it restarts on claim),
    // so the card stays inert until ready.
    <span
      role="status"
      title="This studio is starting up and will be ready shortly."
      className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
    >
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      Provisioning…
    </span>
  )

  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Boxes className="text-muted-foreground h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{title}</div>
          {brand?.tagline ? (
            <div className="text-muted-foreground truncate text-sm">{brand.tagline}</div>
          ) : (
            product.subdomain && (
              <div className="text-muted-foreground truncate text-sm">{product.subdomain}</div>
            )
          )}
        </div>
      </div>
      {brand?.description && (
        <p className="text-muted-foreground mt-3 line-clamp-4 text-sm leading-relaxed">
          {brand.description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          {statusBadge}
          {needsModel && (
            <span
              title="No model connected yet"
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600"
            >
              <PlugZap className="h-3 w-3" aria-hidden />
              Connect a model
            </span>
          )}
        </div>
        {budget && <span className="text-muted-foreground text-xs">{budget}</span>}
        {isReady && <span className="text-muted-foreground text-xs">Open →</span>}
        {isSleeping && <span className="text-muted-foreground text-xs">Wake →</span>}
      </div>
    </>
  )

  const card = canOpen ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cardClass}>
      {body}
    </a>
  ) : (
    <div className={cardClass}>{body}</div>
  )

  // The action sits beside the card link, not inside it: a button nested in an anchor is invalid.
  if (locked || !canOpen || !studioAppsEnabled()) return card
  return (
    <div className="flex flex-col gap-2">
      {card}
      <MakeAppDialog studioEnvironmentId={product.envId} label={title} />
    </div>
  )
}
