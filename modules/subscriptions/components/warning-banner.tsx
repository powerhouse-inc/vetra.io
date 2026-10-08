import { AlertTriangle, Clock } from 'lucide-react'
import { Banner } from '@/modules/apps/components/banner'
import { formatDate } from '@/modules/apps/lib/time'
import { warningTone } from '../lib/subscriptions'
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
    >
      {warning.message}
    </Banner>
  )
}
