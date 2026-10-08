'use client'

import { BadgeCheck, Clock } from 'lucide-react'
import Link from 'next/link'
import { Banner } from '@/modules/apps/components/banner'
import { Button } from '@/modules/shared/components/ui/button'
import { useSubscriptionForEnvironment } from '../hooks/use-subscriptions'
import { isLive, subscriptionHref, subscriptionName, warningTone } from '../lib/subscriptions'

export function EnvironmentLicenceBadge({ environmentId }: { environmentId: string }) {
  const { subscription: s } = useSubscriptionForEnvironment(environmentId)
  if (!s) return null
  const warning = s.warnings[0]
  return (
    <div className="space-y-1 text-xs">
      <p className="text-muted-foreground flex items-center gap-1.5">
        <BadgeCheck className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-foreground min-w-0 font-medium break-all">{`${s.appName} · ${subscriptionName(s)}`}</span>
        <Link
          href={subscriptionHref(s.licenseId)}
          className="text-primary ml-auto shrink-0 hover:underline"
        >
          Subscription
        </Link>
      </p>
      {warning && (
        <p className={warningTone(warning.kind) === 'danger' ? 'text-destructive' : 'text-warning'}>
          {warning.message}
        </p>
      )}
    </div>
  )
}

export function EnvironmentLicenceBanner({ environmentId }: { environmentId: string }) {
  const { subscription: s } = useSubscriptionForEnvironment(environmentId)
  if (!s) return null
  const warning = s.warnings[0]
  const tone = warning ? warningTone(warning.kind) : 'neutral'
  return (
    <Banner
      tone={tone}
      icon={warning ? Clock : BadgeCheck}
      title={`${s.appName} · ${subscriptionName(s)}`}
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href={subscriptionHref(s.licenseId)}>View subscription</Link>
        </Button>
      }
    >
      {warning
        ? warning.message
        : isLive(s)
          ? `This environment comes with your ${subscriptionName(s)} licence for ${s.appName}.`
          : `Your ${subscriptionName(s)} licence for ${s.appName} has ended.`}
    </Banner>
  )
}
