import { PauseCircle } from 'lucide-react'
import { Banner } from '@/modules/apps/components/banner'

/** Shown on licensing tabs while the app is not ACTIVE; the server refuses writes then. */
export function LicensingUnavailableBanner({ status }: { status: string }) {
  const readable = status.toLowerCase().replace(/_/g, ' ')
  return (
    <Banner tone="warning" icon={PauseCircle} title="Licensing is paused for this app">
      This app is {readable}. You can look around, but plans, grants and invite codes can only be
      changed once the app is active again — usually after you authorize its deploy identity.
    </Banner>
  )
}
