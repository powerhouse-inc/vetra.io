'use client'

import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { CloudDashboard } from './cloud-dashboard'
import { useDocumentTitle } from '@/modules/shared/hooks/use-document-title'

/**
 * Authenticated environments view. The public cloud landing lives at `/cloud`.
 * Owners see environments that came with a licence here; only a Renown login is needed.
 */
export default function EnvironmentsPage() {
  useDocumentTitle('Your environments')
  return (
    <RequireLogin title="Log in to see your environments">
      <CloudDashboard />
    </RequireLogin>
  )
}
