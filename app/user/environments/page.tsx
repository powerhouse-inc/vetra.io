'use client'

import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { CloudDashboard } from './cloud-dashboard'

/**
 * Authenticated environments view. The public cloud landing lives at `/cloud`;
 * a logged-out visitor here is sent there. Redirect only on a *definitive*
 * logged-out status (never while auth is still resolving), so this and the
 * `/cloud` page can't ping-pong.
 */
export default function EnvironmentsPage() {
  const { status } = useRenownAuth()
  const router = useRouter()
  const resolving = status === 'loading' || status === 'checking' || status === undefined

  useEffect(() => {
    if (!resolving && status !== 'authorized') router.replace('/cloud')
  }, [resolving, status, router])

  if (status === 'authorized') return <CloudDashboard />
  return null
}
