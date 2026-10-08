'use client'

import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { CloudDashboard } from './cloud-dashboard'

/**
 * Authenticated environments view. The public cloud landing lives at `/cloud`;
 * a logged-out visitor here is sent there. Redirect only on a *definitive*
 * logged-out status (never while auth is still resolving), so this and the
 * `/cloud` page can't ping-pong.
 *
 * Owners see environments that came with a licence here; only a Renown login is needed.
 */
export default function EnvironmentsPage() {
  const { state } = useRenownAuthAsync()
  const router = useRouter()

  useEffect(() => {
    if (state === 'unauthenticated') router.replace('/cloud')
  }, [state, router])

  if (state === 'authenticated') return <CloudDashboard />
  return null
}
