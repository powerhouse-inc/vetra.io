import { Suspense } from 'react'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { SubscriptionsView } from '@/modules/subscriptions/components/subscriptions-view'

export default function SubscriptionsPage() {
  return (
    <main className="mx-auto mt-20 max-w-4xl px-4 py-8 sm:px-6">
      <RequireLogin title="See your subscriptions">
        <Suspense fallback={<SubscriptionsSkeleton />}>
          <SubscriptionsView />
        </Suspense>
      </RequireLogin>
    </main>
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
