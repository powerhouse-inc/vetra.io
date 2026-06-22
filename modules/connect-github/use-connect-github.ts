'use client'

import { useCallback, useRef, useState } from 'react'
import { useRenown } from '@powerhousedao/reactor-browser'
import { getAuthToken } from '@/modules/cloud/graphql'
import {
  connectGithub,
  githubInstallUrl,
  startGithubDeviceFlow,
  type GithubConnection,
} from './lib/client'
import { DEFAULT_POLL_INTERVAL_SECONDS, SLOW_DOWN_BACKOFF_SECONDS } from './lib/constants'

/** The visible state of the device-flow connect for one environment. */
export type ConnectPhase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | {
      kind: 'awaiting'
      userCode: string
      verificationUri: string
      /** Set once the backend reports the app is not installed for the user. */
      installUrl: string | null
    }
  | { kind: 'connected'; connection: GithubConnection }
  | { kind: 'error'; message: string }

const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000))

const TERMINAL_MESSAGES: Record<string, string> = {
  expired: 'The authorization code expired. Try again.',
  denied: 'GitHub authorization was declined.',
  unauthenticated: 'Your session expired. Sign in again.',
}

/**
 * Drives the device-flow connect for one environment: starts the flow, exposes
 * the user code, and polls until the backend reports connected or a terminal
 * status.
 */
export function useConnectGithub(environmentId: string) {
  const renown = useRenown()
  const [phase, setPhase] = useState<ConnectPhase>({ kind: 'idle' })
  const runRef = useRef(0)

  const connect = useCallback(
    async (repoName: string): Promise<void> => {
      const run = (runRef.current += 1)
      const alive = (): boolean => runRef.current === run
      setPhase({ kind: 'starting' })

      const startToken = await getAuthToken(renown)
      if (!startToken) {
        if (alive()) setPhase({ kind: 'error', message: 'Not signed in with Renown.' })
        return
      }
      const flow = await startGithubDeviceFlow(startToken)
      if (!alive()) return
      if (!flow) {
        setPhase({ kind: 'error', message: 'Could not start GitHub authorization.' })
        return
      }
      setPhase({
        kind: 'awaiting',
        userCode: flow.userCode,
        verificationUri: flow.verificationUri,
        installUrl: null,
      })

      let interval = flow.interval || DEFAULT_POLL_INTERVAL_SECONDS
      const deadline = Date.now() + flow.expiresIn * 1000
      while (alive() && Date.now() < deadline) {
        await sleep(interval)
        if (!alive()) return
        const token = await getAuthToken(renown)
        if (!token) {
          setPhase({ kind: 'error', message: 'Not signed in with Renown.' })
          return
        }
        const result = await connectGithub(flow.deviceCode, repoName, environmentId, token)
        if (!alive()) return

        if (result.status === 'connected') {
          if (result.connection) {
            setPhase({ kind: 'connected', connection: result.connection })
          } else {
            setPhase({ kind: 'error', message: 'Connected, but no repository was returned.' })
          }
          return
        }
        if (result.status === 'pending') continue
        if (result.status === 'slowDown') {
          interval += SLOW_DOWN_BACKOFF_SECONDS
          continue
        }
        if (result.status === 'appNotInstalled') {
          setPhase({
            kind: 'awaiting',
            userCode: flow.userCode,
            verificationUri: flow.verificationUri,
            installUrl: githubInstallUrl(),
          })
          continue
        }
        if (result.status === 'repoExists') {
          setPhase({
            kind: 'error',
            message: `A repository named "${repoName}" already exists. Choose another name.`,
          })
          return
        }
        setPhase({
          kind: 'error',
          message:
            result.status === 'error'
              ? result.message
              : (TERMINAL_MESSAGES[result.status] ?? 'GitHub connection failed.'),
        })
        return
      }
      if (alive()) {
        setPhase({ kind: 'error', message: 'The authorization code expired. Try again.' })
      }
    },
    [renown, environmentId],
  )

  return { phase, connect }
}
