import { StudioGroupsView } from '@/modules/cloud/studio/components/studio-groups-view'
import { EarlyAccessGate } from '@/modules/invites/early-access-gate'

export default function UserProductsPage() {
  return (
    <EarlyAccessGate>
      <StudioGroupsView />
    </EarlyAccessGate>
  )
}
