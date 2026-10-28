import { Suspense } from 'react'

import { GithubCallback } from '@/modules/apps/components/github-callback'
import { PageSpinner } from '@/modules/shared/components/page-shell'

export default function GithubCallbackPage() {
  return (
    <Suspense fallback={<PageSpinner label="Connecting GitHub" />}>
      <GithubCallback />
    </Suspense>
  )
}
