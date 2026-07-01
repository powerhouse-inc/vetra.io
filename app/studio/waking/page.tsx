import { Suspense } from 'react'
import { WakingScreen } from '@/modules/cloud/studio/components/waking-screen'

// Client-only (reads the ?host query param + polls); never prerender.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Waking your studio… · Vetra',
}

export default function StudioWakingPage() {
  return (
    <Suspense fallback={null}>
      <WakingScreen />
    </Suspense>
  )
}
