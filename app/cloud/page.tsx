'use client'

import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { CloudLanding } from '@/modules/cloud/components/cloud-landing'

/**
 * Public Vetra Cloud landing page. Signed-in users are forwarded to their
 * environments at `/user/environments`; everyone else (and visitors while auth
 * is still resolving) sees the marketing landing. Redirect fires only on a
 * *definitive* authorized status, so this and `/user/environments` never loop.
 */
export default function CloudLandingPage() {
  const { status } = useRenownAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authorized') router.replace('/user/environments')
  }, [status, router])

  if (status === 'authorized') return null
  return <CloudLanding />
}
