/** Legacy profile logos that may be shown: https URLs and raster data URLs. */
export function safeLegacyLogo(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https:\/\//i.test(url) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(url)
    ? url
    : null
}
