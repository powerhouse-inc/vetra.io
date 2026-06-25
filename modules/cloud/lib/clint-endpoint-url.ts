import type { ClintEndpoint } from '@/modules/cloud/types'
import { resolveGenericHost } from '@/modules/cloud/lib/env-host'

export type ComposeClintEndpointUrlInput = {
  serviceUrl: string | null
  prefix: string
  /** Whether this service is served at the env apex (`<subdomain>.vetra.io`). */
  isApex: boolean
  genericSubdomain: string | null
  genericBaseDomain: string | null
  endpoint: Pick<ClintEndpoint, 'id'>
}

export function composeClintEndpointUrl(input: ComposeClintEndpointUrlInput): string {
  const { serviceUrl, prefix, isApex, genericSubdomain, genericBaseDomain, endpoint } = input
  // The pull-worker stores endpoint.id as the proxy path prefix
  // (e.g. "/switchboard/graphql"), so it already starts with "/".
  // Use it verbatim — joining with "/" would produce "//".
  const id = endpoint.id.startsWith('/') ? endpoint.id : `/${endpoint.id}`
  if (serviceUrl) {
    return `${serviceUrl.replace(/\/$/, '')}${id}`
  }
  const sub = genericSubdomain ?? '<subdomain>'
  const base = genericBaseDomain ?? 'vetra.io'
  // Flattened single-label host (covered by the *.vetra.io wildcard cert),
  // mirroring the gitops processor's resolveGenericHost.
  return `https://${resolveGenericHost(sub, prefix, isApex, base)}${id}`
}
