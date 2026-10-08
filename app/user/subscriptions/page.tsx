import { Suspense } from 'react'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { SubscriptionsView } from '@/modules/subscriptions/components/subscriptions-view'

export default function SubscriptionsPage() {
  return (
    <main className="mx-auto mt-20 max-w-4xl px-4 py-8 sm:px-6">
      <RequireLogin title="See your subscriptions">
        <Suspense fallback={null}>
          <SubscriptionsView />
        </Suspense>
      </RequireLogin>
    </main>
  )
}
