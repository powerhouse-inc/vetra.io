'use client'

import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { CloudDashboard } from './cloud-dashboard'

/**
 * Authenticated environments view. The public cloud landing lives at `/cloud`.
 * Owners see environments that came with a licence here; only a Renown login is needed.
 */
export default function EnvironmentsPage() {
  return (
    <RequireLogin title="Log in to see your environments">
      <CloudDashboard />
    </RequireLogin>
  )
}
