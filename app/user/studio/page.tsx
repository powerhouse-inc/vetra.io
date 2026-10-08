import { StudioProductsGrid } from '@/modules/cloud/studio/components/studio-products-grid'
import { StudioLicenseGate } from '@/modules/studio-license/components/studio-license-gate'

export default function UserStudioPage() {
  return (
    <StudioLicenseGate>
      <StudioProductsGrid />
    </StudioLicenseGate>
  )
}
