'use client'

import { ArrowUpRight, Loader2, Server, Users } from 'lucide-react'
import Link from 'next/link'
import { StatusPill } from '@/modules/apps/components/status'
import { Button } from '@/modules/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import {
  environmentHref,
  isLive,
  issuerText,
  subscriptionName,
  subscriptionStatusMeta,
  validityLine,
} from '../lib/subscriptions'
import type { Subscription } from '../types'
import { WarningBanner } from './warning-banner'

function EnvironmentLine({ s }: { s: Subscription }) {
  if (s.mode === 'SHARED') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Users className="h-4 w-4 shrink-0" aria-hidden />
        An account on {s.appName}
      </span>
    )
  }
  const href = environmentHref(s)
  if (href) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Server className="h-4 w-4 shrink-0" aria-hidden />
        <Link href={href} className="text-foreground font-medium break-all hover:underline">
          {s.environmentLabel || 'Your environment'}
        </Link>
      </span>
    )
  }
  if (isLive(s)) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        Your environment is being set up. This takes a minute or two.
      </span>
    )
  }
  return null
}

export function SubscriptionCard({
  subscription: s,
  highlighted,
  onCancel,
}: {
  subscription: Subscription
  highlighted: boolean
  onCancel: () => void
}) {
  const live = isLive(s)
  return (
    <article
      id={`subscription-${s.licenseId}`}
      data-testid={`subscription-${s.licenseId}`}
      data-highlighted={highlighted ? 'true' : 'false'}
      className={cn(
        'bg-card border-border space-y-4 rounded-xl border p-5 shadow-sm transition-shadow',
        !live && 'bg-muted/30 shadow-none',
        highlighted && 'ring-primary/60 shadow-md ring-2',
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{subscriptionName(s)}</h3>
            <StatusPill meta={subscriptionStatusMeta(s.status)} />
          </div>
          <p className="text-muted-foreground text-sm">
            {validityLine(s)} · {issuerText(s.issuer)}
          </p>
          <div className="text-muted-foreground text-sm">
            <EnvironmentLine s={s} />
          </div>
        </div>
        {live && (
          <div className="flex shrink-0 gap-2">
            {s.openUrl && (
              <Button asChild className="flex-1 sm:flex-none">
                <a href={s.openUrl} target="_blank" rel="noopener noreferrer">
                  Open
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              </Button>
            )}
            <Button variant="ghost" onClick={onCancel} aria-label={`Cancel ${subscriptionName(s)} on ${s.appName}`}>
              Cancel
            </Button>
          </div>
        )}
      </div>
      {s.warnings.length > 0 && (
        <div className="space-y-2">
          {s.warnings.map((w) => (
            <WarningBanner key={`${w.kind}-${w.at}`} warning={w} />
          ))}
        </div>
      )}
    </article>
  )
}
