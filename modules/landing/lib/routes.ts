/** Public pages that render in the dark console look (navbar and footer follow). */
const CONSOLE_ROUTES = new Set(['/', '/cloud', '/studio'])

export function isConsoleRoute(pathname: string): boolean {
  return CONSOLE_ROUTES.has(pathname)
}
