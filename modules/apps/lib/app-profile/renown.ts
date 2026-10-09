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

/** Stable URL of a profile image (302s to storage; 404 when unset). */
export function renownMediaUrl(documentId: string, field: 'logo' | 'cover'): string {
  return `${renownWebUrl()}/media/${encodeURIComponent(documentId)}/${field}`
}
