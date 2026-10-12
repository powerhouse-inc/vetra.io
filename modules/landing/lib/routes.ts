/** Public pages that render in the dark console look (navbar and footer follow). */
const CONSOLE_ROUTES = new Set(['/', '/cloud', '/studio'])

export function isConsoleRoute(pathname: string): boolean {
  return CONSOLE_ROUTES.has(pathname)
}

/** Where a logged-out visitor on a gated route goes: Studio routes get the Studio pitch, the rest go home. */
export function loggedOutDestination(pathname: string): string {
  return pathname === '/user/studio' || pathname.startsWith('/user/studio/') ? '/studio' : '/'
}
