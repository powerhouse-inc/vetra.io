type Redirect = {
  source: string
  destination: string
  permanent: boolean
  has?: { type: 'query'; key: string; value?: string }[]
}

/**
 * Public pages retired from the site for now. Temporary (307) so they can
 * come back. The package directory is back as a single list, so old package
 * detail links land on it.
 */
export const LEGACY_REDIRECTS: Redirect[] = [
  // `:path+`, not `:path*`: zero segments would match /packages itself and loop.
  { source: '/packages/:path+', destination: '/packages', permanent: false },
  { source: '/builders', destination: '/', permanent: false },
  { source: '/builders/:path*', destination: '/', permanent: false },
  // Empty placeholders that were never linked from the site.
  { source: '/contributors', destination: '/', permanent: false },
  { source: '/finances', destination: '/', permanent: false },
  // The old /profile hub duplicated the console: its tabs live in /user/settings
  // (profile, organisations) and /user/packages. The query string carries over.
  {
    source: '/profile',
    has: [{ type: 'query', key: 'tab', value: 'packages' }],
    destination: '/user/packages',
    permanent: false,
  },
  { source: '/profile', destination: '/user/settings', permanent: false },
  // Builder teams were replaced by Renown organisations.
  {
    source: '/profile/create-team',
    destination: '/user/settings?tab=organisations',
    permanent: false,
  },
  {
    source: '/profile/teams/:path*',
    destination: '/user/settings?tab=organisations',
    permanent: false,
  },
]
