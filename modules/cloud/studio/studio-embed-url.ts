import { STUDIO_BASE_DOMAIN } from './constants'

export function buildStudioEmbedUrl(input: {
  prefix: string
  genericSubdomain: string | null
  genericBaseDomain: string | null
  userDid?: string | null
}): string {
  const sub = input.genericSubdomain || '<subdomain>'
  const base = input.genericBaseDomain || STUDIO_BASE_DOMAIN
  const root = `https://${input.prefix}.${sub}.${base}/`
  return input.userDid ? `${root}?user=${encodeURIComponent(input.userDid)}` : root
}
