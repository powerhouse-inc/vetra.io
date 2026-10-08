'use client'

import { BadgeCheck, Ticket } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { EmptyState, TabError, TabSkeleton } from '@/modules/publisher/components/primitives'
import { Button } from '@/modules/shared/components/ui/button'
import { useMySubscriptions } from '../hooks/use-subscriptions'
import { groupByApp, type AppGroup } from '../lib/subscriptions'
import type { Subscription } from '../types'
import { CancelDialog } from './cancel-dialog'
import { SubscriptionCard } from './subscription-card'

function AppSection({
  group,
  highlight,
  onCancel,
}: {
  group: AppGroup
  highlight: string | null
  onCancel: (s: Subscription) => void
}) {
  const [showPast, setShowPast] = useState(group.past.some((s) => s.licenseId === highlight))
  const headingId = `app-${group.appId}`
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-lg font-semibold">
          {group.appName}
        </h2>
        <span className="text-muted-foreground text-sm">
          {group.live.length === 0 ? 'Nothing active' : `${group.live.length} active`}
        </span>
      </div>
      <div className="space-y-3">
        {group.live.map((s) => (
          <SubscriptionCard
            key={s.licenseId}
            subscription={s}
            highlighted={s.licenseId === highlight}
            onCancel={() => onCancel(s)}
          />
        ))}
        {showPast &&
          group.past.map((s) => (
            <SubscriptionCard
              key={s.licenseId}
              subscription={s}
              highlighted={s.licenseId === highlight}
              onCancel={() => onCancel(s)}
            />
          ))}
      </div>
      {group.past.length > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setShowPast((x) => !x)}>
          {showPast ? 'Hide ended' : `Show ${group.past.length} ended`}
        </Button>
      )}
    </section>
  )
}

/** `/user/subscriptions` — everything I hold, grouped by app. */
export function SubscriptionsView() {
  const subs = useMySubscriptions()
  const params = useSearchParams()
  const highlight = params.get('highlight')
  const [cancelling, setCancelling] = useState<Subscription | null>(null)
  const groups = groupByApp(subs.data ?? [])

  // Bring a just-redeemed subscription into view once it has rendered.
  useEffect(() => {
    if (!highlight || !subs.data) return
    document
      .getElementById(`subscription-${highlight}`)
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [highlight, subs.data])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground max-w-2xl">
            Apps you have access to, how long for, and where they run.
          </p>
        </div>
        <Button asChild variant="outline" className="self-start sm:self-auto">
          <Link href="/redeem">
            <Ticket className="h-4 w-4" aria-hidden />
            Redeem a code
          </Link>
        </Button>
      </div>
      {subs.isPending ? (
        <TabSkeleton rows={3} label="Loading subscriptions" />
      ) : subs.error ? (
        <TabError
          error={subs.error}
          onRetry={() => void subs.refetch()}
          retrying={subs.isRefetching}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="No subscriptions yet"
          action={
            <Button asChild>
              <Link href="/redeem">Redeem a code</Link>
            </Button>
          }
        >
          When an app gives you access — with an invite code or directly — it shows up here, with a
          button to open it.
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <AppSection key={g.appId} group={g} highlight={highlight} onCancel={setCancelling} />
          ))}
        </div>
      )}
      <CancelDialog subscription={cancelling} onClose={() => setCancelling(null)} />
    </div>
  )
}
