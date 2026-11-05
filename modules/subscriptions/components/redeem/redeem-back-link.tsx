'use client'

import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

/** /redeem is public; a signed-in owner who came from the console gets a way back to it. */
export function RedeemBackLink() {
  const auth = useRenownAuthAsync()
  if (auth.state !== 'authenticated') return null
  return (
    <Link
      href="/user/subscriptions"
      className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2 text-sm transition-colors"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Subscriptions
    </Link>
  )
}
