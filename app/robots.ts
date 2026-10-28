import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/modules/landing/lib/links'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Signed-in app routes and personal invite links are not for search engines.
      disallow: ['/user', '/profile', '/redeem/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
