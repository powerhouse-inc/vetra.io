import type { RenownAppProfile } from './api'
import { renownMediaUrl } from './renown'

/** Legacy profile logos that may be shown: https URLs and raster data URLs. */
export function safeLegacyLogo(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https:\/\//i.test(url) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(url)
    ? url
    : null
}

/** An app profile's logo: the uploaded one (versioned /media URL), else a safe legacy URL. */
export function profileLogoUrl(
  profile: Pick<RenownAppProfile, 'documentId' | 'logoRef' | 'logo'>,
): string | null {
  if (profile.logoRef) return renownMediaUrl(profile.documentId, 'logo', profile.logoRef)
  return safeLegacyLogo(profile.logo)
}
