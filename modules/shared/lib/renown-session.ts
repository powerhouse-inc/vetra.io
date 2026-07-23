import { RENOWN_SESSION_COOKIE, verifyRenownSession, type RenownSession } from '@renown/sdk/node'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { renownSwitchboardUrl } from '@/modules/shared/config/renown'

// Server-side auth check, memoized per request. Token-only by default (fast):
// verifies the JWT signature + expiry and merges the cookie's display hint.
export const verifySession = cache(async (): Promise<RenownSession | null> => {
  const cookie = (await cookies()).get(RENOWN_SESSION_COOKIE)?.value
  if (!cookie) return null
  const session = await verifyRenownSession(cookie, {
    switchboardUrl: renownSwitchboardUrl(),
  })
  return session ?? null
})
