import { PauseCircle } from 'lucide-react'
import { Banner } from '@/modules/apps/components/banner'

/** What the publisher has to do first, by app status. The page shows the matching action above. */
function nextStep(status: string): string {
  switch (status) {
    case 'PENDING_IDENTITY':
      return 'Authorize this app on Renown first, with the button above.'
    case 'DISCONNECTED':
      return 'Reconnect this app to GitHub first, as shown above.'
    default:
      return 'This app is not active right now.'
  }
}

/** Shown on licensing tabs while the app is not ACTIVE; the server refuses writes then. */
export function LicensingUnavailableBanner({ status }: { status: string }) {
  return (
    <Banner tone="warning" icon={PauseCircle} title="Licensing is paused for this app">
      {nextStep(status)} Until then you can look around, but plans, grants and invite codes can’t be
      changed.
    </Banner>
  )
}
