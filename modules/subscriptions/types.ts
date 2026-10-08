/** vetraSubscriptions (vetra-licensing subgraph), exactly as the contract names them. */

export type InviteCodeCheck = {
  valid: boolean
  /** All null when invalid. */
  appId: string | null
  appName: string | null
  kind: string | null
  termLabel: string | null
  /** DEDICATED | SHARED — only DEDICATED asks for a project name. */
  mode: string | null
}

export type SubscriptionWarningKind =
  'EXPIRING' | 'ENDED_STOP_PENDING' | 'STOPPED_DELETE_PENDING' | 'DELETE_IMMINENT'

export type SubscriptionWarning = { kind: SubscriptionWarningKind; at: string; message: string }

export type Subscription = {
  licenseId: string
  appId: string
  appName: string
  kind: string
  termLabel: string | null
  issuer: string
  status: string
  start: string | null
  end: string | null
  mode: 'SHARED' | 'DEDICATED'
  environmentId: string | null
  environmentLabel: string | null
  /** The environment's primary URL (DEDICATED) or the app URL (SHARED). */
  openUrl: string | null
  stoppedAt: string | null
  deleteAfter: string | null
  warnings: SubscriptionWarning[]
}

export type StudioAccess = {
  allowed: boolean
  licenseId: string | null
  expires: string | null
  hasAttachedKey: boolean
}

export type RedeemInviteCodeInput = {
  code: string
  /** Project name for a DEDICATED environment; ignored for SHARED. */
  label?: string | null
  /** Replace this licence (same app) instead of starting a new environment. */
  upgrades?: string | null
}
