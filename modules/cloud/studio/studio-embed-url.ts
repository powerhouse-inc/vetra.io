import { STUDIO_BASE_DOMAIN } from './constants'
import { resolveGenericHost } from '@/modules/cloud/lib/env-host'

export function buildStudioEmbedUrl(input: {
  prefix: string
  genericSubdomain: string | null
  genericBaseDomain: string | null
  userDid?: string | null
}): string {
  const sub = input.genericSubdomain || '<subdomain>'
  const base = input.genericBaseDomain || STUDIO_BASE_DOMAIN
  // A Studio is a sole-CLINT env, so its agent is served at the APEX host
  // (`<subdomain>.vetra.io`) — single label, covered by the *.vetra.io wildcard.
  // Mirrors the gitops processor (isTypeAtApex CLINT for a sole service).
  const root = `https://${resolveGenericHost(sub, input.prefix, true, base)}/`
  return input.userDid ? `${root}?user=${encodeURIComponent(input.userDid)}` : root
}
