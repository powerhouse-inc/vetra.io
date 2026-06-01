// Wallet (public address) persisted on login so the server layout can seed
// `<OpenPanelComponent profileId>` and attribute a returning user's first
// pageview. A cookie (not localStorage) so it's readable at SSR time.
export const OP_PROFILE_COOKIE = 'op_profile'

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function writeProfileHint(profileId: string): void {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${OP_PROFILE_COOKIE}=${encodeURIComponent(profileId)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

export function clearProfileHint(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${OP_PROFILE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}
