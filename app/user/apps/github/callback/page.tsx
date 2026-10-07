import { Suspense } from 'react'

import { GithubCallback } from '@/modules/apps/components/github-callback'

export default function GithubCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GithubCallback />
    </Suspense>
  )
}
