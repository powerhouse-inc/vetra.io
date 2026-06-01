'use client'

import { OpenPanelComponent, useOpenPanel } from '@openpanel/nextjs'
import { useEffect, useRef } from 'react'
import { getOpenPanelApiUrl, getOpenPanelClientId } from './config'
import { ANALYTICS_APP } from './events'
import { buildTraits, type RenownTraitsSource } from './openpanel-traits'

/**
 * The slice of the Renown instance (`window.ph.renown`) we read. Typed
 * structurally and loosely on purpose — the `@renown/sdk` user shape drifts
 * between versions, and we only touch an explicit allow-list of fields.
 */
interface RenownUser {
  address?: string | null
  ens?: { name?: string | null; avatarUrl?: string | null } | null
  profile?: RenownTraitsSource['profile']
}
interface RenownInstance {
  status?: string
  user?: RenownUser | null
  on?: (event: 'user' | 'status', cb: () => void) => (() => void) | undefined
}

function getRenownInstance(): RenownInstance | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { ph?: { renown?: RenownInstance } }).ph?.renown ?? null
}

/**
 * Flattens the raw Renown user into the trait source, mirroring how
 * `useRenownAuth()` derives its fields — but without subscribing to any React
 * store. The OpenPanel profile ID is the wallet **address**: the same
 * identifier Renown uses on its own domain, so the two apps stitch into one
 * cross-app user profile (vetra.io → renown handoff → back). The Renown profile
 * documentId would NOT match Renown's own identify call and would split one
 * user into two profiles.
 */
function readIdentity(renown: RenownInstance | null): {
  profileId: string | undefined
  source: RenownTraitsSource
} {
  const user = renown?.status === 'authorized' ? (renown.user ?? undefined) : undefined
  const ensName = user?.ens?.name ?? undefined
  return {
    profileId: user?.address ?? undefined,
    source: {
      address: user?.address,
      ensName,
      avatarUrl: user?.profile?.userImage ?? user?.ens?.avatarUrl,
      displayName: ensName ?? user?.profile?.username ?? undefined,
      profile: user?.profile,
    },
  }
}

/**
 * Identifies the logged-in Renown user with OpenPanel and clears the profile
 * on logout.
 *
 * Why imperative (not `useRenownAuth()`): the Renown SDK mutates its global
 * `window.ph` store **during render** (`<Renown>` → `useRenownInit` →
 * `setRenown(null)`). Because that store is exposed through `useSyncExternalStore`,
 * every React subscriber gets an update scheduled mid-render — React's
 * "Cannot update a component while rendering a different component" warning.
 * This component only performs side effects (identify/clear), so it has no
 * reason to be a React subscriber: it listens to the Renown event emitter
 * directly and calls `op.*` (never `setState`), sidestepping the warning
 * entirely. A `prevProfileRef` distinguishes login from logout; all SDK calls
 * are wrapped so analytics can never throw into the app.
 */
function IdentifyRenownUser(): null {
  const op = useOpenPanel()
  const prevProfileRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    let boundRenown: RenownInstance | null = null
    let offUser: (() => void) | undefined
    let offStatus: (() => void) | undefined

    const evaluate = () => {
      const renown = getRenownInstance()

      // Re-bind to the live instance whenever it is (re)created by the SDK.
      if (renown !== boundRenown) {
        offUser?.()
        offStatus?.()
        boundRenown = renown
        offUser = renown?.on?.('user', evaluate)
        offStatus = renown?.on?.('status', evaluate)
      }

      const { profileId, source } = readIdentity(renown)
      const prev = prevProfileRef.current
      if (profileId === prev) return
      prevProfileRef.current = profileId

      if (profileId) {
        try {
          op.identify({ profileId, properties: buildTraits(source) })
        } catch (err) {
          console.warn('[analytics] Failed to identify user:', err)
        }
      } else if (prev) {
        try {
          op.clear()
        } catch (err) {
          console.warn('[analytics] Failed to clear user:', err)
        }
      }
    }

    // The Renown instance is (re)assigned via a `ph:renownUpdated` window event;
    // listen for that to (re)bind, and evaluate the current state immediately.
    window.addEventListener('ph:renownUpdated', evaluate)
    evaluate()

    return () => {
      window.removeEventListener('ph:renownUpdated', evaluate)
      offUser?.()
      offStatus?.()
    }
  }, [op])

  return null
}

/**
 * Mounts the OpenPanel analytics subsystem for Vetra.
 *
 * Kill switch (ported from Connect): an empty client ID renders `null`, so the
 * SDK script is never loaded and analytics is fully disabled. Configure
 * `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` to enable.
 *
 * When enabled:
 * - Automatic pageview tracking across App Router navigations (`trackScreenViews`).
 * - Outgoing-link tracking (`trackOutgoingLinks`).
 * - Logged-in Renown users are identified via `<IdentifyRenownUser />`.
 *
 * Mounted as a side-effect-only sibling of `<RenownProvider />` in the root layout.
 */
export function AnalyticsProvider(): React.ReactNode {
  const clientId = getOpenPanelClientId()
  const apiUrl = getOpenPanelApiUrl()

  if (!clientId) return null

  return (
    <>
      <OpenPanelComponent
        clientId={clientId}
        {...(apiUrl ? { apiUrl } : {})}
        trackScreenViews
        trackOutgoingLinks
        globalProperties={{ app: ANALYTICS_APP }}
      />
      <IdentifyRenownUser />
    </>
  )
}
