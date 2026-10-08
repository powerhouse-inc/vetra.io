import type { Metadata } from 'next'
import { RedeemCodePage } from '@/modules/subscriptions/components/redeem/redeem-code-page'

export const metadata: Metadata = {
  title: 'Redeem a code · Vetra',
  robots: { index: false, follow: false },
}

export default async function RedeemCodeRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <RedeemCodePage rawCode={code} />
}
