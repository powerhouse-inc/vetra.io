import { Suspense } from 'react'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { SubscriptionsView } from '@/modules/subscriptions/components/subscriptions-view'

export default function SubscriptionsPage() {
  return (
    <RequireLogin title="See your subscriptions">
      <main className="mx-auto mt-20 max-w-screen-xl px-6 py-8">
        <Suspense fallback={<SubscriptionsSkeleton />}>
          <SubscriptionsView />
        </Suspense>
      </main>
    </RequireLogin>
  )
}

function SubscriptionsSkeleton() {
  return (
    <div role="status" aria-label="Loading your subscriptions" className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  )
}
