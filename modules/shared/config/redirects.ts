/**
 * Public pages retired from the site for now. Temporary (307) so they can
 * come back; the registry stays reachable for signed-in users.
 */
export const LEGACY_REDIRECTS = [
  { source: '/packages', destination: '/user/packages', permanent: false },
  { source: '/packages/:path*', destination: '/user/packages', permanent: false },
  { source: '/builders', destination: '/', permanent: false },
  { source: '/builders/:path*', destination: '/', permanent: false },
] satisfies { source: string; destination: string; permanent: boolean }[]
