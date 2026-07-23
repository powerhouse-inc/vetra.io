import { RENOWN_SESSION_COOKIE, verifyRenownSession } from '@renown/sdk/node'
import { NextResponse, type NextRequest } from 'next/server'

// Gate the authenticated areas: verify the session cookie's JWT signature +
// expiry (no network check; page + DAL stay authoritative), else bounce to sign-in.
export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(RENOWN_SESSION_COOKIE)?.value
  const session = cookie
    ? await verifyRenownSession(cookie, { verifyCredential: false })
    : undefined

  if (session) return NextResponse.next()

  // Send logged-out visitors to the public home; login is an explicit action
  // there (no auto-open param, which otherwise re-fires on the post-logout refetch).
  return NextResponse.redirect(new URL('/', request.url))
}

export const config = {
  // Gate the user dashboard and profile areas; everything else stays public.
  matcher: ['/user/:path*', '/profile/:path*'],
}
