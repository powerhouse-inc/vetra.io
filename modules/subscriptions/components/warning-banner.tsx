import { AlertTriangle, Clock, Loader2, Plus, Ticket } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Banner } from '@/modules/apps/components/banner'
import { Button } from '@/modules/shared/components/ui/button'
import { warningTone, withDisplayDates } from '../lib/subscriptions'
import { useRecreateEnvironment } from '../hooks/use-subscriptions'
import type { SubscriptionWarning } from '../types'

// What happened; the server's message carries the date, so the title does not.
const TITLE: Record<string, string> = {
  EXPIRING: 'Ending soon',
  ENDED_STOP_PENDING: 'Licence ended',
  STOPPED_DELETE_PENDING: 'Environment stopped',
  DELETE_IMMINENT: 'Environment about to be deleted',
  ENVIRONMENT_DELETED: 'Environment deleted',
}

/** The licence still covers an environment: ask for a new one in place of the deleted one. */
function CreateEnvironmentButton({ licenseId }: { licenseId: string }) {
  const recreate = useRecreateEnvironment()
  return (
    <Button
      size="sm"
      disabled={recreate.isPending}
      onClick={() =>
        recreate.mutate(
          { licenseId },
          {
            onSuccess: () => toast.success('Your new environment is being set up'),
            onError: (err) => toast.error(err.message),
          },
        )
      }
    >
      {recreate.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Plus className="h-3.5 w-3.5" aria-hidden />
      )}
      Create new environment
    </Button>
  )
}

export function WarningBanner({
  warning,
  licenseId,
}: {
  warning: SubscriptionWarning
  licenseId: string
}) {
  const tone = warningTone(warning.kind)
  return (
    <Banner
      tone={tone}
      icon={tone === 'danger' ? AlertTriangle : Clock}
      title={TITLE[warning.kind] ?? 'Heads up'}
      actions={
        warning.kind === 'ENVIRONMENT_DELETED' ? (
          <CreateEnvironmentButton licenseId={licenseId} />
        ) : (
          // Renewing is redeeming a new code for the same app: the redeem flow offers to
          // continue this environment instead of starting a new one.
          <Button asChild size="sm" variant="outline">
            <Link href="/redeem">
              <Ticket className="h-3.5 w-3.5" aria-hidden />
              Renew with a code
            </Link>
          </Button>
        )
      }
    >
      {withDisplayDates(warning.message)}
    </Banner>
  )
}
