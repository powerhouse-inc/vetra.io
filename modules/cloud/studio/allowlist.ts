// Default allowlist mirrors the staging ADMINS set so the feature is usable
// out of the box for admins; NEXT_PUBLIC_STUDIO_ALLOWLIST extends/overrides it.
const DEFAULT_ALLOWLIST = [
  '0x1ad3d72e54fb0eb46e87f82f77b284fc8a66b16c',
  '0x50379ddb64b77e990bc4a433c9337618c70d2c2a',
]

export function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
}

/** Effective allowlist: env var if set, else the built-in admin default. */
export function getStudioAllowlist(): string[] {
  const fromEnv = parseAllowlist(process.env.NEXT_PUBLIC_STUDIO_ALLOWLIST)
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWLIST
}

export function isStudioAllowed(address: string | null | undefined, allowlist: string[]): boolean {
  if (!address) return false
  if (allowlist.length === 0) return false
  return allowlist.includes(address.toLowerCase())
}
