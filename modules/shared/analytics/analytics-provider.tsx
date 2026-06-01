'use client'

import { OpenPanelComponent, useOpenPanel } from '@openpanel/nextjs'
import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { useEffect, useRef } from 'react'
import { getOpenPanelApiUrl, getOpenPanelClientId } from './config'
import { ANALYTICS_APP } from './events'
import { buildTraits } from './openpanel-traits'

/**
 * Identifies the logged-in Renown user with OpenPanel and clears the profile
 * on logout.
 *
 * Reads auth **reactively** via `useRenownAuth()` — the same hook the navbar
 * uses to render the logged-in state — and fires `identify`/`clear` from an
 * effect on the actual login → logout transition. This mirrors Renown's own
 * `AnalyticsIdentity` component, which is the reference integration.
 *
 * (A previous version subscribed to the raw `window.ph.renown` event emitter
 * imperatively to avoid a feared "setState during render" warning. In practice
 * the navbar consumes `useRenownAuth()` without issue, and the imperative
 * binding failed to reliably catch the login transition — so events went out
 * anonymous even while the UI showed the user as logged in.)
 *
 * The OpenPanel profile ID is the wallet **address**: the same identifier
 * Renown uses on its own domain, so the two apps stitch into one cross-app user
 * profile (vetra.io → renown handoff → back). The Renown profile documentId
 * would NOT match Renown's own identify call and would split one user into two
 * profiles. `buildTraits()` forwards only an allow-list of safe fields and never
 * the credential/JWT. A `prevProfileRef` distinguishes login from logout so we
 * only act on an actual transition; all SDK calls are wrapped so analytics can
 * never throw into the app.
 */
function IdentifyRenownUser(): null {
  const auth = useRenownAuth()
  const op = useOpenPanel()
  const prevProfileRef = useRef<string | undefined>(undefined)

  const profileId = auth.status === 'authorized' ? (auth.address ?? undefined) : undefined

  useEffect(() => {
    const prev = prevProfileRef.current
    if (profileId === prev) return
    prevProfileRef.current = profileId

    if (profileId) {
      try {
        op.identify({
          profileId,
          properties: buildTraits({
            address: auth.address,
            ensName: auth.ensName,
            avatarUrl: auth.avatarUrl,
            displayName: auth.displayName,
            profile: auth.user?.profile,
          }),
        })
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
  }, [profileId, op, auth])

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
