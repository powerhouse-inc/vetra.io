'use client'

import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { AlertTriangle, Github, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/modules/shared/components/ui/button'

import { describeAppsError } from '../graphql'
import { useConnectGithubDeploy } from '../hooks/use-apps'

/**
 * Landing page for the Vetra Deploy GitHub App's install/authorize redirect
 * (`?code=…&installation_id=…&state=…`). Exchanges the one-time code, then
 * returns to the new-app flow, which restores its draft from sessionStorage.
 */
export function GithubCallback() {
  const params = useSearchParams()
  const router = useRouter()
  const { state: authState } = useRenownAuthAsync()
  const connect = useConnectGithubDeploy()
  const [error, setError] = useState<string | null>(null)
  // OAuth codes are single-use: never send one twice (StrictMode, re-renders).
  const sent = useRef(false)
  const code = params.get('code')

  useEffect(() => {
    if (authState !== 'authenticated' || sent.current) return
    sent.current = true
    if (!code) {
      router.replace('/user/apps/new')
      return
    }
    connect.mutate(code, {
      onSuccess: () => router.replace('/user/apps/new'),
      onError: (err) => setError(describeAppsError(err)),
    })
  }, [authState, code, connect, router])

  return (
    <main className="mx-auto mt-20 flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-6 py-8 text-center">
      <span className="bg-foreground text-background flex h-12 w-12 items-center justify-center rounded-2xl">
        <Github className="h-6 w-6" aria-hidden />
      </span>
      {error ? (
        <>
          <div className="space-y-1.5" role="alert">
            <p className="flex items-center justify-center gap-2 font-semibold">
              <AlertTriangle className="text-destructive h-4 w-4" aria-hidden />
              GitHub connection failed
            </p>
            <p className="text-muted-foreground text-sm">{error}</p>
          </div>
          <Button asChild>
            <Link href="/user/apps/new">Back to new app</Link>
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground flex items-center gap-2 text-sm" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Connecting your GitHub account…
        </p>
      )}
    </main>
  )
}
