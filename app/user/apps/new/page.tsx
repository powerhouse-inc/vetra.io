import { NewAppWizard } from '@/modules/apps/components/new-app-wizard'
import { EarlyAccessGate } from '@/modules/invites/early-access-gate'

export default function NewAppPage() {
  return (
    <EarlyAccessGate>
      <NewAppWizard />
    </EarlyAccessGate>
  )
}
