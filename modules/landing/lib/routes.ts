/** Public pages that render in the dark console look (navbar and footer follow). */
const CONSOLE_ROUTES = new Set(['/', '/cloud', '/studio'])

export function isConsoleRoute(pathname: string): boolean {
  return CONSOLE_ROUTES.has(pathname)
}

/**
 * Signed-in app routes (the console and profile). Only these follow the light/dark
 * theme setting and show live sync state; every other page is public/marketing.
 */
export function isAppRoute(pathname: string): boolean {
  return ['/user', '/profile'].some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

/** Where a logged-out visitor on a gated route goes: Studio routes get the Studio pitch, the rest go home. */
export function loggedOutDestination(pathname: string): string {
  return pathname === '/user/studio' || pathname.startsWith('/user/studio/') ? '/studio' : '/'
}
