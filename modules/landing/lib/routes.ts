/** Public pages that render in the dark console look (navbar and footer follow). */
const CONSOLE_ROUTES = new Set(['/', '/cloud', '/studio'])

export function isConsoleRoute(pathname: string): boolean {
  return CONSOLE_ROUTES.has(pathname)
}

/** Query param that asks the landing page to open the login dialog. */
export const LOGIN_PARAM = 'login'
/** Query param carrying where to go once the login succeeds. */
export const NEXT_PARAM = 'next'

const MAX_NEXT_LENGTH = 2048
const PROBE_ORIGIN = 'https://vetra.invalid'

/**
 * A post-login destination is accepted only as a same-origin relative path: it must
 * start with a single `/`, carry no backslashes or control characters (browsers turn
 * `/\host` and `/\t/host` into `//host`), and still resolve to a single-slash path on
 * this origin. Anything else returns null, so `?next=` can never open-redirect.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_NEXT_LENGTH) {
    return null
  }
  if (!value.startsWith('/') || value.startsWith('//')) return null
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null
  let url: URL
  try {
    url = new URL(value, PROBE_ORIGIN)
  } catch {
    return null
  }
  // Dot segments can collapse `/a/..//host` into `//host`: check the normalised form too.
  if (url.origin !== PROBE_ORIGIN || url.pathname.startsWith('//')) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/** Routes that need a login (the proxy matcher): the user dashboard and profile areas. */
export function isGatedPath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0]
  return (
    pathname === '/user' ||
    pathname.startsWith('/user/') ||
    pathname === '/profile' ||
    pathname.startsWith('/profile/')
  )
}

/**
 * Signed-in app routes (the console and profile). Only these follow the light/dark
 * theme setting and show live sync state; every other page is public/marketing.
 */
export function isAppRoute(pathname: string): boolean {
  return isGatedPath(pathname)
}

/** Where a logged-out visitor on a gated route goes: Studio routes get the Studio pitch, the rest go home. */
export function loggedOutDestination(pathname: string): string {
  return pathname === '/user/studio' || pathname.startsWith('/user/studio/') ? '/studio' : '/'
}

/**
 * Where the proxy sends an anonymous request for a gated route: the logged-out
 * destination, asking it to open the login dialog and return to the original path
 * (and query) afterwards.
 */
export function loginRedirectPath(pathname: string, search = ''): string {
  const params = new URLSearchParams({ [LOGIN_PARAM]: '1' })
  const next = safeNextPath(`${pathname}${search}`)
  if (next) params.set(NEXT_PARAM, next)
  return `${loggedOutDestination(pathname)}?${params.toString()}`
}
