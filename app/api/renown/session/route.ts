import { RENOWN_SESSION_COOKIE, serializeRenownSessionCookie } from '@renown/sdk/node'
import { cookies } from 'next/headers'

const MAX_AGE = 7 * 24 * 60 * 60 // 7 days, matching the token lifetime

interface SessionBody {
  token?: string
  profile?: { name?: string | null; avatar?: string | null } | null
}

// Reject cross-origin writes: the cookie is set from a caller-supplied token, so
// an off-site POST could fixate a victim into the attacker's session (login CSRF).
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

// The client POSTs the minted bearer token (+ display hint) after sign-in; we
// store them together in an HttpOnly cookie. DELETE clears it on logout.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'cross-origin' }, { status: 403 })
  }
  const { token, profile } = (await request.json()) as SessionBody
  if (!token) {
    return Response.json({ error: 'missing token' }, { status: 400 })
  }
  const store = await cookies()
  store.set(RENOWN_SESSION_COOKIE, serializeRenownSessionCookie({ token, profile }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
  return Response.json({ ok: true })
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'cross-origin' }, { status: 403 })
  }
  const store = await cookies()
  store.delete(RENOWN_SESSION_COOKIE)
  return Response.json({ ok: true })
}
