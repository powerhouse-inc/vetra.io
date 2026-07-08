import { StudioProductsGrid } from '@/modules/cloud/studio/components/studio-products-grid'
import { EarlyAccessGate } from '@/modules/invites/early-access-gate'

// The grouped studios view (StudioGroupsView) is disabled for now — this route
// renders the same products grid as /user so both paths show one experience.
export default function UserProductsPage() {
  return (
    <EarlyAccessGate>
      <StudioProductsGrid />
    </EarlyAccessGate>
  )
}
