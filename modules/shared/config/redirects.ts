type Redirect = {
  source: string
  destination: string
  permanent: boolean
  has?: { type: 'query'; key: string; value?: string }[]
}

/**
 * Public pages retired from the site for now. Temporary (307) so they can
 * come back. Packages now live on Cloud, where they are installed.
 */
export const LEGACY_REDIRECTS: Redirect[] = [
  { source: '/packages', destination: '/cloud', permanent: false },
  { source: '/packages/:path*', destination: '/cloud', permanent: false },
  { source: '/builders', destination: '/', permanent: false },
  { source: '/builders/:path*', destination: '/', permanent: false },
  // Empty placeholders that were never linked from the site.
  { source: '/contributors', destination: '/', permanent: false },
  { source: '/finances', destination: '/', permanent: false },
  // The old /profile hub duplicated the console: its tabs live in /user/settings
  // (profile, teams) and /user/packages. The query string (e.g. ?tab=teams) carries
  // over. Team pages under /profile/teams and /profile/create-team stay.
  {
    source: '/profile',
    has: [{ type: 'query', key: 'tab', value: 'packages' }],
    destination: '/user/packages',
    permanent: false,
  },
  { source: '/profile', destination: '/user/settings', permanent: false },
]
