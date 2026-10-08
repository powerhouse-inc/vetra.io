'use client'

import { RedeemFlow } from './redeem-flow'
import { safeDecode } from '../../lib/redeem'

/** Client part of /redeem/[code]: the route segment arrives still encoded and is decoded once here. */
export function RedeemCodePage({ rawCode }: { rawCode: string }) {
  return (
    <main className="mx-auto mt-24 max-w-xl px-4 py-10 sm:px-6">
      <RedeemFlow code={safeDecode(rawCode)} />
    </main>
  )
}
