'use client'

import { useEffect } from 'react'
import { setAuthTokenProvider } from '../client'

/**
 * Registers a bearer-token provider with the reactor client so every cloud
 * GraphQL request carries the current user's Renown identity.
 *
 * Mount this once, near the top of the tree (after `<RenownProvider />`).
 * It has no rendered output.
 *
 * NOTE: we deliberately do NOT subscribe to the Renown store via
 * `useRenown()`. The SDK's `<Renown>` component initializes Renown *during
 * its render* (`setRenown(null)` → synchronous `ph:renownUpdated` event),
 * which would schedule a state update in this subscribed component while
 * `<Renown>` is still rendering — React's "Cannot update a component while
 * rendering a different component" warning. Instead we register a single,
 * stable provider that reads the live Renown instance from `window.ph` at
 * request time (the only moment a token is actually needed), so this
 * component never re-renders on auth changes.
 */
export function CloudAuthBridge() {
  useEffect(() => {
    // NOTE: we intentionally do NOT pass `aud` here. The server's
    // `verifyAuthBearerToken` doesn't configure an expected audience, and
    // did-jwt rejects tokens that carry an `aud` claim without matching
    // audience config ("JWT audience is required but your app address has
    // not been configured"). Omitting `aud` keeps the token valid.
    setAuthTokenProvider(async () => {
      const renown = window.ph?.renown
      if (!renown) return null
      try {
        const token = await renown.getBearerToken({ expiresIn: 600 })
        return token ?? null
      } catch {
        return null
      }
    })

    return () => {
      setAuthTokenProvider(null)
    }
  }, [])

  return null
}
