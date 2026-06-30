'use client'

import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { EarlyAccessGate } from '@/modules/invites/early-access-gate'
import { CloudDashboard } from './cloud-dashboard'

/**
 * Authenticated environments view. The public cloud landing lives at `/cloud`;
 * a logged-out visitor here is sent there. Redirect only on a *definitive*
 * logged-out status (never while auth is still resolving), so this and the
 * `/cloud` page can't ping-pong.
 *
 * Gated behind the early-access invite code (same as /user/products) so
 * environments can't be created without a redeemed code.
 */
export default function EnvironmentsPage() {
  const { status } = useRenownAuth()
  const router = useRouter()
  const resolving = status === 'loading' || status === 'checking' || status === undefined

  useEffect(() => {
    if (!resolving && status !== 'authorized') router.replace('/cloud')
  }, [resolving, status, router])

  if (status === 'authorized')
    return (
      <EarlyAccessGate>
        <CloudDashboard />
      </EarlyAccessGate>
    )
  return null
}
