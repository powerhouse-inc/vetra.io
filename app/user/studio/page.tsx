import type { Metadata } from 'next'
import { StudioProductsGrid } from '@/modules/cloud/studio/components/studio-products-grid'
import { StudioLicenseGate } from '@/modules/studio-license/components/studio-license-gate'

export const metadata: Metadata = { title: 'Studio' }

export default function UserStudioPage() {
  return (
    // Without a live studio licence the existing studios stay listed; only creating is gated.
    <StudioLicenseGate notAllowed={<StudioProductsGrid locked />}>
      <StudioProductsGrid />
    </StudioLicenseGate>
  )
}
