import type { App, AppDeployment, AppDeploymentStatus, AppStatus } from '../types'

/** Visual tone shared by status dots and badges. */
export type StatusTone = 'success' | 'progress' | 'danger' | 'neutral' | 'warning'

export type StatusMeta = {
  label: string
  tone: StatusTone
  /** True while the deployment is still moving (pulse animation + polling). */
  active: boolean
}

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

/** PENDING and DEPLOYING are the only states that can still change on their own. */
export function isDeploymentInFlight(status: AppDeploymentStatus | null | undefined): boolean {
  return status === 'PENDING' || status === 'DEPLOYING'
}

const APP_STATUS_META: Record<AppStatus, StatusMeta> = {
  PENDING_IDENTITY: { label: 'Needs authorization', tone: 'warning', active: false },
  ACTIVE: { label: 'Active', tone: 'success', active: false },
  DISCONNECTED: { label: 'Disconnected', tone: 'danger', active: false },
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

/** Tailwind classes per tone (dot fill / soft badge). */
export const TONE_DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  progress: 'bg-warning',
  danger: 'bg-destructive',
  warning: 'bg-warning',
  neutral: 'bg-muted-foreground/60',
}

export const TONE_BADGE: Record<StatusTone, string> = {
  success: 'bg-success/15 text-success',
  progress: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/15 text-destructive',
  warning: 'bg-warning/15 text-warning',
  neutral: 'bg-muted text-muted-foreground',
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
  app: Pick<App, 'latestDeployment' | 'previews'> | null | undefined,
): number | false {
  if (!app) return false
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
