'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useRenownAuth } from '@powerhousedao/reactor-browser'

// Forward a signed-in visitor from the homepage to /user. Only on a resolved
// 'authorized' status — never SSR/loading/'initial', which are logged-out too.
export function HomeAuthedRedirect() {
  const auth = useRenownAuth()
  const router = useRouter()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    if (auth.status === 'authorized') {
      handled.current = true
      router.replace('/user')
    }
  }, [auth.status, router])

  return null
}
