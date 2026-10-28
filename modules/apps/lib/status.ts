import type { StatusMeta } from '@/modules/shared/lib/status'

import type { App, AppDeployment, AppDeploymentStatus, AppStatus } from '../types'

export type { StatusMeta, StatusTone } from '@/modules/shared/lib/status'

const DEPLOYMENT_STATUS_META: Record<AppDeploymentStatus, StatusMeta> = {
  PENDING: { label: 'Queued', tone: 'progress', active: true },
  DEPLOYING: { label: 'Deploying', tone: 'progress', active: true },
  READY: { label: 'Ready', tone: 'success', active: false },
  FAILED: { label: 'Failed', tone: 'danger', active: false },
  SUPERSEDED: { label: 'Superseded', tone: 'neutral', active: false },
}

export function deploymentStatusMeta(status: AppDeploymentStatus | null | undefined): StatusMeta {
  if (!status) return { label: 'Not deployed', tone: 'neutral', active: false }
  return DEPLOYMENT_STATUS_META[status] ?? { label: status, tone: 'neutral', active: false }
}

export type DeploymentRowStatus = {
  meta: StatusMeta
  /** The backend's `error` text: red for failures, muted when it's just a reason. */
  note: { text: string; tone: 'danger' | 'muted' } | null
}

const CLOSED_PR_REASON = /^pull request #\d+ (is )?closed$/

/**
 * Status for one row of the deployments table. Unlike Vercel, a replaced
 * deployment here no longer runs (production redeploys onto the same env,
 * closed-PR previews are deleted), so "Ready" would be misleading:
 * - a READY production deployment that isn't the live one → Superseded
 *   (still READY in the data, which is what rollback relies on);
 * - a preview torn down because its PR closed → Closed.
 * Only FAILED keeps its `error` red; other reasons are informational.
 */
export function deploymentRowStatus(
  d: Pick<AppDeployment, 'id' | 'kind' | 'status' | 'error'>,
  liveProductionId: string | undefined,
): DeploymentRowStatus {
  let meta = deploymentStatusMeta(d.status)
  if (d.kind === 'PRODUCTION' && d.status === 'READY' && d.id !== liveProductionId) {
    meta = DEPLOYMENT_STATUS_META.SUPERSEDED
  } else if (
    d.kind === 'PREVIEW' &&
    d.status === 'SUPERSEDED' &&
    d.error &&
    CLOSED_PR_REASON.test(d.error)
  ) {
    meta = { label: 'Closed', tone: 'neutral', active: false }
  }
  const note = d.error
    ? ({ text: d.error, tone: d.status === 'FAILED' ? 'danger' : 'muted' } as const)
    : null
  return { meta, note }
}

/** PENDING and DEPLOYING are the only states that can still change on their own. */
export function isDeploymentInFlight(status: AppDeploymentStatus | null | undefined): boolean {
  return status === 'PENDING' || status === 'DEPLOYING'
}

const APP_STATUS_META: Record<AppStatus, StatusMeta> = {
  PENDING_IDENTITY: { label: 'Needs authorization', tone: 'warning', active: false },
  ACTIVE: { label: 'Active', tone: 'success', active: false },
  DISCONNECTED: { label: 'Disconnected', tone: 'danger', active: false },
  DELETED: { label: 'Deleted', tone: 'neutral', active: false },
}

export function appStatusMeta(status: AppStatus): StatusMeta {
  return APP_STATUS_META[status] ?? { label: status, tone: 'neutral', active: false }
}

/**
 * The one status an App card shows: App-level problems win (identity, GitHub),
 * otherwise the latest deployment's state, otherwise "No deployments".
 */
export function appHeadlineStatus(app: Pick<App, 'status' | 'latestDeployment'>): StatusMeta {
  if (app.status !== 'ACTIVE') return appStatusMeta(app.status)
  if (!app.latestDeployment) return { label: 'No deployments', tone: 'neutral', active: false }
  return deploymentStatusMeta(app.latestDeployment.status)
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

/** Poll cadence while something is deploying; `false` stops polling. */
export const IN_FLIGHT_POLL_MS = 4000

export function deploymentsPollInterval(
  deployments: ReadonlyArray<Pick<AppDeployment, 'status'>> | null | undefined,
): number | false {
  return deployments?.some((d) => isDeploymentInFlight(d.status)) ? IN_FLIGHT_POLL_MS : false
}

export function appPollInterval(
  app: (Pick<App, 'latestDeployment' | 'previews'> & { status?: App['status'] }) | null | undefined,
): number | false {
  if (!app || app.status === 'DELETED') return false
  if (isDeploymentInFlight(app.latestDeployment?.status)) return IN_FLIGHT_POLL_MS
  if (app.previews.some((p) => isDeploymentInFlight(p.status))) return IN_FLIGHT_POLL_MS
  return false
}

export function appsPollInterval(
  apps: ReadonlyArray<Pick<App, 'latestDeployment' | 'previews'>> | null | undefined,
): number | false {
  return apps?.some((a) => appPollInterval(a) !== false) ? IN_FLIGHT_POLL_MS : false
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : ''
}

export function githubRepoUrl(fullName: string): string {
  return `https://github.com/${fullName}`
}

export function githubCommitUrl(fullName: string, sha: string): string {
  return `https://github.com/${fullName}/commit/${sha}`
}

export function githubPullUrl(fullName: string, prNumber: number): string {
  return `https://github.com/${fullName}/pull/${prNumber}`
}

/**
 * Human label for a git ref: `refs/heads/main` → `main`, `refs/tags/v1` → `v1`,
 * `refs/pull/42/merge` → `PR #42`. Bare branch names pass through.
 */
export function refLabel(ref: string | null | undefined): string {
  if (!ref) return ''
  const pull = /^refs\/pull\/(\d+)\//.exec(ref)
  if (pull) return `PR #${pull[1]}`
  return ref.replace(/^refs\/(heads|tags)\//, '')
}

/** Rollback re-applies a READY production deployment's versions. */
export function canRollback(d: Pick<AppDeployment, 'kind' | 'status'>): boolean {
  return d.kind === 'PRODUCTION' && d.status === 'READY'
}

/** The URL a user most likely wants to open: the front-end, else Connect, else Switchboard. */
export function primaryUrl(
  urls: { app: string | null; connect: string | null; switchboard: string | null } | null,
): string | null {
  if (!urls) return null
  return urls.app ?? urls.connect ?? urls.switchboard ?? null
}

/** `https://foo-connect.vetra.io/` → `foo-connect.vetra.io` for compact display. */
export function displayHost(url: string | null | undefined): string {
  if (!url) return ''
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

/** A soft-deleted app (visible to admins only) is shown read-only: no actions at all. */
export function isAppReadOnly(app: Pick<App, 'status'>): boolean {
  return app.status === 'DELETED'
}

// ---------------------------------------------------------------------------
// Deploy identity lifetime
// ---------------------------------------------------------------------------

/** Warn this many days before the deploy identity's delegation expires. */
export const IDENTITY_WARN_DAYS = 30

const DAY_MS = 86_400_000

export type IdentityState =
  /** Never authorized yet (new app). */
  | { kind: 'pending' }
  /** Authorized; `daysLeft` ≥ IDENTITY_WARN_DAYS. */
  | { kind: 'valid'; expiresAt: string; daysLeft: number }
  /** Authorized but expiring soon. */
  | { kind: 'expiring'; expiresAt: string; daysLeft: number }
  /** Was authorized, now expired: CI deploys are paused until re-authorized. */
  | { kind: 'expired'; expiresAt: string | null }
  /** No expiry known (older backend) or not applicable (deleted app). */
  | { kind: 'unknown' }

export function identityState(
  app: Pick<App, 'status' | 'latestDeployment'> & { identityExpiresAt?: string | null },
  now: Date = new Date(),
): IdentityState {
  if (app.status === 'DELETED') return { kind: 'unknown' }
  const expiresAt = app.identityExpiresAt ?? null
  const expiryMs = expiresAt ? new Date(expiresAt).getTime() : NaN
  const hasExpiry = !Number.isNaN(expiryMs)

  if (app.status === 'PENDING_IDENTITY') {
    // Had a delegation (an expiry date, or it already deployed) → it lapsed.
    if (hasExpiry || app.latestDeployment) return { kind: 'expired', expiresAt }
    return { kind: 'pending' }
  }
  if (!hasExpiry || !expiresAt) return { kind: 'unknown' }
  const msLeft = expiryMs - now.getTime()
  if (msLeft <= 0) return { kind: 'expired', expiresAt }
  const daysLeft = Math.floor(msLeft / DAY_MS)
  return daysLeft < IDENTITY_WARN_DAYS
    ? { kind: 'expiring', expiresAt, daysLeft }
    : { kind: 'valid', expiresAt, daysLeft }
}
