import type { Metadata } from 'next'
import { NewAppWizard } from '@/modules/apps/components/new-app-wizard'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'

export const metadata: Metadata = { title: 'Create an app' }

/** Connecting a repository and publishing needs a login only; Vetra Studio keeps its licence. */
export default function NewAppPage() {
  return (
    <RequireLogin>
      <NewAppWizard />
    </RequireLogin>
  )
}
