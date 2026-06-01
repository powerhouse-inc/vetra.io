'use client'

import { OpenPanelComponent, useOpenPanel } from '@openpanel/nextjs'
import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { useEffect, useRef } from 'react'
import { getOpenPanelApiUrl, getOpenPanelClientId } from './config'
import { buildTraits } from './openpanel-traits'

/**
 * Identifies the logged-in Renown user with OpenPanel and clears the profile
 * on logout.
 *
 * Mirrors Connect's transition detection (`apps/connect/src/components/openpanel.tsx`):
 * a `prevProfileRef` distinguishes login (`undefined → profileId`) from logout
 * (`profileId → undefined`). All SDK calls are wrapped so analytics can never
 * throw into the app.
 */
function IdentifyRenownUser(): null {
  const op = useOpenPanel()
  const auth = useRenownAuth()

  const profileId = auth.status === 'authorized' ? auth.profileId : undefined
  const prevProfileRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const prev = prevProfileRef.current
    prevProfileRef.current = profileId

    if (!prev && profileId) {
      // Login: undefined → profileId (or client mounted with user already in).
      try {
        op.identify({ profileId, properties: buildTraits(auth) })
      } catch (err) {
        console.warn('[analytics] Failed to identify user:', err)
      }
    } else if (prev && !profileId) {
      // Logout: profileId → undefined.
      try {
        op.clear()
      } catch (err) {
        console.warn('[analytics] Failed to clear user:', err)
      }
    }
    // `auth` is intentionally omitted: we only re-run on identity transitions,
    // not on every auth-object reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, op])

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
      />
      <IdentifyRenownUser />
    </>
  )
}
