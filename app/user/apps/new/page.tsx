import type { Metadata } from 'next'
import { NewAppWizard } from '@/modules/apps/components/new-app-wizard'
import { StudioLicenseGate } from '@/modules/studio-license/components/studio-license-gate'

export const metadata: Metadata = { title: 'Create an app' }

export default function NewAppPage() {
  return (
    <StudioLicenseGate>
      <NewAppWizard />
    </StudioLicenseGate>
  )
}
