import { NewAppWizard } from '@/modules/apps/components/new-app-wizard'
import { StudioLicenseGate } from '@/modules/studio-license/components/studio-license-gate'

export default function NewAppPage() {
  return (
    <StudioLicenseGate>
      <NewAppWizard />
    </StudioLicenseGate>
  )
}
