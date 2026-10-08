import { StudioProductsGrid } from '@/modules/cloud/studio/components/studio-products-grid'
import { StudioLicenseGate } from '@/modules/studio-license/components/studio-license-gate'

export default function UserStudioPage() {
  return (
    // Without a live studio licence the existing studios stay listed; only creating is gated.
    <StudioLicenseGate notAllowed={<StudioProductsGrid locked />}>
      <StudioProductsGrid />
    </StudioLicenseGate>
  )
}
