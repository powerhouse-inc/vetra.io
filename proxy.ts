import { RENOWN_SESSION_COOKIE, verifyRenownSession } from '@renown/sdk/node'
import { NextResponse, type NextRequest } from 'next/server'
import { loginRedirectPath } from '@/modules/landing/lib/routes'

// Gate the authenticated areas: verify the session cookie's JWT signature +
// expiry (no network check; page + DAL stay authoritative), else bounce to sign-in.
export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(RENOWN_SESSION_COOKIE)?.value
  const session = cookie
    ? await verifyRenownSession(cookie, { verifyCredential: false })
    : undefined

  if (session) return NextResponse.next()

  // Send logged-out visitors to the public home (or the Studio page for studio
  // routes) with ?login=1&next=<original path>: the login dialog opens there and
  // returns them here afterwards. The post-logout refetch also lands on this
  // redirect; AuthRedirect ignores the flag right after a logout so it can't reopen.
  const { pathname, search } = request.nextUrl
  return NextResponse.redirect(new URL(loginRedirectPath(pathname, search), request.url))
}

export const config = {
  // Gate the user dashboard and profile areas; everything else stays public.
  matcher: ['/user/:path*', '/profile/:path*'],
}
