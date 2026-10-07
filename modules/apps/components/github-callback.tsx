'use client'

import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { AlertTriangle, Github, Loader2, LogIn } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { useOpenLogin } from '@/modules/shared/components/renown/login-modal-context'
import { Button } from '@/modules/shared/components/ui/button'

import { describeAppsError } from '../graphql'
import { useConnectGithubDeploy, useGithubDeployAppInfo } from '../hooks/use-apps'
import { consumeGithubState, GITHUB_REAUTH_KEY, startGithubFlow } from '../lib/github-state'

/** How long to wait for the Renown session before offering an explicit sign-in. */
export const CALLBACK_AUTH_TIMEOUT_MS = 10_000

type Failure = { title: string; message: string; action: string }

const FOREIGN_STATE: Failure = {
  title: 'GitHub link not recognised',
  message: "This GitHub link wasn't started from this browser — start again.",
  action: 'Start again',
}

/** True once per tab: marks that we restarted the authorize flow ourselves. */
function claimReauthorize(): boolean {
  try {
    if (window.sessionStorage.getItem(GITHUB_REAUTH_KEY)) return false
    window.sessionStorage.setItem(GITHUB_REAUTH_KEY, '1')
    return true
  } catch {
    return false
  }
}

function clearReauthorize(): void {
  try {
    window.sessionStorage.removeItem(GITHUB_REAUTH_KEY)
  } catch {
    /* storage blocked */
  }
}

function readNonceMatch(state: string | null): boolean {
  try {
    return consumeGithubState(window.sessionStorage, state)
  } catch {
    return false
  }
}

/**
 * Landing page for the Vetra Deploy GitHub App's install/authorize redirect
 * (`?code=…&installation_id=…&state=…`). The code is exchanged only when
 * `state` matches the nonce this browser stored before leaving for GitHub
 * (login-CSRF protection), and only once. Then the new-app flow resumes and
 * restores its draft from sessionStorage.
 *
 * Installing the app on GitHub returns here without our `state` (and sometimes
 * without a code). Such a code is never used; instead the authorize flow is
 * restarted once with a fresh state. GitHub answers it immediately for an
 * installed app, so install → repo list is one uninterrupted round-trip.
 */
export function GithubCallback() {
  const params = useSearchParams()
  const router = useRouter()
  const { state: authState } = useRenownAuthAsync()
  const openLogin = useOpenLogin()
  const connect = useConnectGithubDeploy()
  const appInfo = useGithubDeployAppInfo()
  const authorizeUrl = appInfo.data?.authorizeUrl
  const [failure, setFailure] = useState<Failure | null>(null)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  // OAuth codes are single-use: never send one twice (StrictMode, re-renders).
  const handled = useRef(false)
  const code = params.get('code')
  const state = params.get('state')
  const authenticated = authState === 'authenticated'

  useEffect(() => {
    if (!authenticated || handled.current) return
    // Checked (and the nonce burned) only after sign-in, so a sign-in that
    // reloads the page doesn't lose it.
    const matches = code ? readNonceMatch(state) : false
    if (!code || !matches) {
      // Never exchange a code we didn't start. Restart the authorize flow once.
      if (!authorizeUrl) return // wait for the app info
      handled.current = true
      if (claimReauthorize()) {
        startGithubFlow(authorizeUrl)
        return
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot outcome of the redirect
      setFailure(FOREIGN_STATE)
      return
    }
    handled.current = true
    clearReauthorize()
    connect.mutate(code, {
      onSuccess: () => router.replace('/user/apps/new'),
      onError: (err) =>
        setFailure({
          title: 'GitHub connection failed',
          message: describeAppsError(err),
          action: 'Back to new app',
        }),
    })
  }, [authenticated, code, state, connect, router, authorizeUrl])

  // Don't spin forever if the Renown session never shows up.
  useEffect(() => {
    if (authenticated) return
    const timer = setTimeout(() => setNeedsSignIn(true), CALLBACK_AUTH_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [authenticated])

  return (
    <main className="mx-auto mt-20 flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-6 py-8 text-center">
      <span className="bg-foreground text-background flex h-12 w-12 items-center justify-center rounded-2xl">
        <Github className="h-6 w-6" aria-hidden />
      </span>
      {failure ? (
        <>
          <div className="space-y-1.5" role="alert">
            <p className="flex items-center justify-center gap-2 font-semibold">
              <AlertTriangle className="text-destructive h-4 w-4" aria-hidden />
              {failure.title}
            </p>
            <p className="text-muted-foreground text-sm">{failure.message}</p>
          </div>
          <Button asChild>
            <Link href="/user/apps/new">{failure.action}</Link>
          </Button>
        </>
      ) : !authenticated && needsSignIn ? (
        <>
          <div className="space-y-1.5">
            <p className="font-semibold">Sign in to continue</p>
            <p className="text-muted-foreground text-sm">
              Log in with Renown to finish connecting your GitHub account.
            </p>
          </div>
          <Button onClick={openLogin}>
            <LogIn className="h-4 w-4" />
            Sign in to continue
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
