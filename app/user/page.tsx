import { EarlyAccessGate } from '@/modules/invites/early-access-gate'

import { AppsHome } from './apps-home'

/** Logged-in home: Vetra Apps, standalone environments and a link to Studio. */
export default function UserHomePage() {
  return (
    <EarlyAccessGate>
      <AppsHome />
    </EarlyAccessGate>
  )
}
