import { StudioProductsGrid } from '@/modules/cloud/studio/components/studio-products-grid'
import { EarlyAccessGate } from '@/modules/invites/early-access-gate'

export default function UserStudioPage() {
  return (
    <EarlyAccessGate>
      <StudioProductsGrid />
    </EarlyAccessGate>
  )
}
