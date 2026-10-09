import { readEnv, renownSwitchboardUrl } from '@/modules/shared/config/renown'

/** Renown's public site (staging: renown-staging.vetra.io), for app pages and media URLs. */
export function renownWebUrl(): string {
  return (readEnv('NEXT_PUBLIC_RENOWN_URL') || 'https://www.renown.id').replace(/\/+$/, '')
}

/** The Renown switchboard's origin, from its GraphQL endpoint (`…/graphql`). */
export function renownSwitchboardOrigin(switchboard = renownSwitchboardUrl()): string {
  return switchboard.replace(/\/+$/, '').replace(/\/graphql$/, '')
}

/** renown-stats GraphQL: app profiles (public reads). */
export function renownStatsEndpoint(switchboard = renownSwitchboardUrl()): string {
  return `${renownSwitchboardOrigin(switchboard)}/graphql/renown-stats`
}

/** renown-package's HTTP routes on the Renown switchboard (the gated upload route). */
export function renownPackageRoutes(switchboard = renownSwitchboardUrl()): string {
  return `${renownSwitchboardOrigin(switchboard)}/api/@powerhousedao/renown-package`
}

/** The app's public page on Renown. */
export function appPageUrl(appDid: string): string {
  return `${renownWebUrl()}/app/${appDid}`
}

/** First 12 hex of the sha256 inside an `attachment://v1:<sha256>` ref, else null. */
export function mediaVersion(ref: string | null | undefined): string | null {
  return /^attachment:\/\/v1:([0-9a-f]{64})$/.exec(ref ?? '')?.[1].slice(0, 12) ?? null
}

/** Stable URL of a profile image (302s to storage; 404 when unset). Pass the ref to bust caches on replace. */
export function renownMediaUrl(documentId: string, field: 'logo' | 'cover', ref?: string | null): string {
  const version = mediaVersion(ref)
  return `${renownWebUrl()}/media/${encodeURIComponent(documentId)}/${field}${version ? `?v=${version}` : ''}`
}
