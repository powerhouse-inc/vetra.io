import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/modules/landing/lib/links'

/** Public pages only; the signed-in app (/user, /profile) is disallowed in robots.ts. */
const PUBLIC_PATHS = [
  '/',
  '/cloud',
  '/studio',
  '/docs/deploy',
  '/docs/app-stats',
  '/redeem',
  '/privacy-policy',
  '/terms-and-conditions',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: path === '/' ? SITE_URL : `${SITE_URL}${path}`,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }))
}
