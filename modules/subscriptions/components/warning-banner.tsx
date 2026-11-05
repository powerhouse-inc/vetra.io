import { AlertTriangle, Clock, Ticket } from 'lucide-react'
import Link from 'next/link'
import { Banner } from '@/modules/apps/components/banner'
import { Button } from '@/modules/shared/components/ui/button'
import { formatDate } from '@/modules/shared/lib/time'
import { warningTone, withDisplayDates } from '../lib/subscriptions'
import type { SubscriptionWarning } from '../types'

const TITLE: Record<string, string> = {
  EXPIRING: 'Ending soon',
  ENDED_STOP_PENDING: 'Your environment will stop',
  STOPPED_DELETE_PENDING: 'Your environment is stopped',
  DELETE_IMMINENT: 'Your environment will be deleted',
}

export function WarningBanner({ warning }: { warning: SubscriptionWarning }) {
  const tone = warningTone(warning.kind)
  return (
    <Banner
      tone={tone}
      icon={tone === 'danger' ? AlertTriangle : Clock}
      title={`${TITLE[warning.kind] ?? 'Heads up'} · ${formatDate(warning.at)}`}
      actions={
        // Renewing is redeeming a new code for the same app: the redeem flow offers to
        // continue this environment instead of starting a new one.
        <Button asChild size="sm" variant="outline">
          <Link href="/redeem">
            <Ticket className="h-3.5 w-3.5" aria-hidden />
            Renew with a code
          </Link>
        </Button>
      }
    >
      {withDisplayDates(warning.message)}
    </Banner>
  )
}
