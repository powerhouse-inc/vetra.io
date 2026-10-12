/**
 * Public pages retired from the site for now. Temporary (307) so they can
 * come back. Packages now live on Cloud, where they are installed.
 */
export const LEGACY_REDIRECTS = [
  { source: '/packages', destination: '/cloud', permanent: false },
  { source: '/packages/:path*', destination: '/cloud', permanent: false },
  { source: '/builders', destination: '/', permanent: false },
  { source: '/builders/:path*', destination: '/', permanent: false },
] satisfies { source: string; destination: string; permanent: boolean }[]
