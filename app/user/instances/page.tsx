import type { Metadata } from 'next'
import { MyInstances } from '@/modules/apps/components/my-instances'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'

export const metadata: Metadata = { title: 'My instances' }

export default function MyInstancesPage() {
  return (
    <RequireLogin title="See your instances">
      <main className="mx-auto mt-20 max-w-screen-xl px-6 py-8">
        <MyInstances />
      </main>
    </RequireLogin>
  )
}
