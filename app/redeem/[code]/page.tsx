'use client'

import { use } from 'react'
import { RedeemFlow } from '@/modules/subscriptions/components/redeem/redeem-flow'
import { safeDecode } from '@/modules/subscriptions/lib/redeem'

export default function RedeemCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  return (
    <main className="mx-auto mt-24 max-w-xl px-4 py-10 sm:px-6">
      <RedeemFlow code={safeDecode(code)} />
    </main>
  )
}
