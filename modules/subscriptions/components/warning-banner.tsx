import { AlertTriangle, Clock, Ticket } from 'lucide-react'
import Link from 'next/link'
import { Banner } from '@/modules/apps/components/banner'
import { Button } from '@/modules/shared/components/ui/button'
import { warningTone, withDisplayDates } from '../lib/subscriptions'
import type { SubscriptionWarning } from '../types'

// What happened; the server's message carries the date, so the title does not.
const TITLE: Record<string, string> = {
  EXPIRING: 'Ending soon',
  ENDED_STOP_PENDING: 'Licence ended',
  STOPPED_DELETE_PENDING: 'Environment stopped',
  DELETE_IMMINENT: 'Environment about to be deleted',
}

export function WarningBanner({ warning }: { warning: SubscriptionWarning }) {
  const tone = warningTone(warning.kind)
  return (
    <Banner
      tone={tone}
      icon={tone === 'danger' ? AlertTriangle : Clock}
      title={TITLE[warning.kind] ?? 'Heads up'}
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
