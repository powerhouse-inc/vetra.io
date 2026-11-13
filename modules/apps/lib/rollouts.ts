import type {
  AppPlan,
  AppRelease,
  AppRollout,
  AppRolloutStep,
  InstanceBackup,
  InstanceRestore,
  InstanceRestoreStatus,
  RolloutStatus,
  RolloutStepStatus,
} from '../types'

export const ROLLOUT_STATUS_LABEL: Record<RolloutStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  complete: 'Complete',
  cancelled: 'Cancelled',
  rolled_back: 'Rolled back',
}

export const ROLLOUT_STATUS_CLASS: Record<RolloutStatus, string> = {
  active: 'bg-info/15 text-info',
  paused: 'bg-warning/15 text-warning',
  complete: 'bg-success/15 text-success',
  cancelled: 'bg-muted text-muted-foreground',
  rolled_back: 'bg-muted text-muted-foreground',
}

export const STEP_STATUS_LABEL: Record<RolloutStepStatus, string> = {
  pending: 'Waiting',
  backing_up: 'Backing up',
  applying: 'Updating',
  restoring: 'Restoring backup',
  succeeded: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
  revert_pending: 'Waiting to go back',
  reverting: 'Going back',
  revert_failed: 'Going back failed',
  rolled_back: 'Rolled back',
}

export const STEP_STATUS_CLASS: Record<RolloutStepStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  backing_up: 'bg-info/15 text-info',
  applying: 'bg-info/15 text-info',
  restoring: 'bg-info/15 text-info',
  succeeded: 'bg-success/15 text-success',
  failed: 'bg-destructive/15 text-destructive',
  skipped: 'bg-muted text-muted-foreground',
  revert_pending: 'bg-muted text-muted-foreground',
  reverting: 'bg-info/15 text-info',
  revert_failed: 'bg-destructive/15 text-destructive',
  rolled_back: 'bg-muted text-muted-foreground',
}

/** A rollout that can still change: its controls apply and it is polled. */
export const isRolloutLive = (r: Pick<AppRollout, 'status'>): boolean =>
  r.status === 'active' || r.status === 'paused'

const isFailedStep = (s: Pick<AppRolloutStep, 'status'>) =>
  s.status === 'failed' || s.status === 'revert_failed'

/** Which controls a rollout offers: resume is refused by the server while a step is failed. */
export function rolloutControls(r: AppRollout): {
  pause: boolean
  resume: boolean
  cancel: boolean
  rollBack: boolean
  resumeBlocked: boolean
} {
  const live = isRolloutLive(r)
  return {
    pause: r.status === 'active',
    resume: r.status === 'paused',
    cancel: live,
    // A rollback goes back what moved: forward rollouts that did something, not a rollback itself.
    rollBack:
      r.direction === 'forward' &&
      r.status !== 'rolled_back' &&
      r.steps.some((s) => s.status === 'succeeded' || s.status === 'failed'),
    resumeBlocked: r.status === 'paused' && r.steps.some(isFailedStep),
  }
}

/** Retry only a failed step; skip a failed or waiting one. */
export function stepActions(step: Pick<AppRolloutStep, 'status'>, live: boolean) {
  return {
    retry: live && step.status === 'failed',
    skip: live && (step.status === 'failed' || step.status === 'pending'),
  }
}

/** Who started a rollout: `vetra` (a policy) is shown as such, anyone else as a person. */
export const isVetraActor = (who: string): boolean => who.toLowerCase() === 'vetra'

/** Whether rolling back needs the holder-data warning: the release it moved to migrates data. */
export function rollbackLosesData(
  rollout: Pick<AppRollout, 'version'>,
  releases: AppRelease[] | undefined,
): boolean {
  return releases?.find((r) => r.version === rollout.version)?.migrates === true
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** Orders versions like semver (prereleases before their release); unparsable ones last. */
export function compareVersions(a: string, b: string): number {
  const pa = SEMVER.exec(a)
  const pb = SEMVER.exec(b)
  if (!pa || !pb) return pa ? 1 : pb ? -1 : a.localeCompare(b)
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i])
    if (d !== 0) return d
  }
  if (pa[4] === pb[4]) return 0
  if (!pa[4]) return 1
  if (!pb[4]) return -1
  return pa[4].localeCompare(pb[4], undefined, { numeric: true })
}

export const isWithdrawn = (r: Pick<AppRelease, 'withdrawnAt'>): boolean => !!r.withdrawnAt

/** Releases a rollout may move to: never builds, never withdrawn ones; newest first. */
export function rollableReleases(releases: AppRelease[] | undefined): AppRelease[] {
  return (releases ?? [])
    .filter((r) => r.kind === 'release' && !isWithdrawn(r))
    .sort((a, b) => compareVersions(b.version, a.version))
}

/** The newest release newer than a plan's target ("x.y.z available"); null when up to date. */
export function newerRelease(plan: AppPlan, releases: AppRelease[] | undefined): string | null {
  const newest = rollableReleases(releases)[0]
  if (!newest) return null
  return !plan.targetVersion || compareVersions(newest.version, plan.targetVersion) > 0
    ? newest.version
    : null
}

export const BACKUP_REASON_LABEL: Record<string, string> = {
  daily: 'Daily',
  manual: 'Manual',
  pre_restore: 'Before restore',
  pre_stop: 'Before stop',
}

/** `pre_update` reads "Before update 1.3.0" (the release it was taken at). */
export function backupReasonLabel(b: Pick<InstanceBackup, 'reason' | 'version'>): string {
  if (b.reason === 'pre_update') return b.version ? `Before update ${b.version}` : 'Before update'
  return BACKUP_REASON_LABEL[b.reason] ?? b.reason
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

export const RESTORE_PHASE_LABEL: Record<InstanceRestoreStatus, string> = {
  safety_backup: 'Safety backup',
  stopping: 'Stopping',
  restoring_db: 'Restoring database',
  restoring_data: 'Restoring files',
  starting: 'Starting',
  succeeded: 'Done',
  failed: 'Failed',
}

/** `restore:<id>` while a backup is restored into the instance. */
export const isRestoring = (maintenance: string | null | undefined): boolean =>
  !!maintenance && maintenance.startsWith('restore:')

/** `held:<id>` after a failed restore: stopped until one succeeds. */
export const isHeld = (maintenance: string | null | undefined): boolean =>
  !!maintenance && maintenance.startsWith('held:')

/** The restore a `restore:<id>` / `held:<id>` marker points at, else the newest. */
export function restoreOf(
  maintenance: string | null | undefined,
  restores: InstanceRestore[] | undefined,
): InstanceRestore | undefined {
  const id = maintenance?.split(':')[1]
  return restores?.find((r) => r.id === id) ?? restores?.[0]
}

/** Only a ready backup of the release the instance runs can be restored from the console. */
export function canRestore(
  backup: Pick<InstanceBackup, 'status' | 'version'>,
  runningVersion: string | null,
): boolean {
  return backup.status === 'ready' && (!backup.version || backup.version === runningVersion)
}

/** Estimated monthly euros for `n` warm instances, from the plan's current estimate; null when it has none to scale. */
export function warmCostEstimate(plan: AppPlan, n: number): number | null {
  const effective = plan.warmPoolEffective ?? 0
  if (effective <= 0) return null
  return Math.round(((plan.warmPoolEurPerMonth ?? 0) / effective) * n)
}

export const WEEKDAYS = [
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
  { n: 7, label: 'Sun' },
] as const

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function timeZones(): string[] {
  try {
    const zones = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.('timeZone')
    if (zones?.length) return zones.includes('UTC') ? zones : ['UTC', ...zones]
  } catch {
    // fall through
  }
  return ['UTC']
}

/** `follow:<branch>` → the branch; null for the other policies. */
export function followBranch(policy: string): string | null {
  return policy.startsWith('follow:') ? policy.slice('follow:'.length) : null
}

export function policyLabel(policy: string): string {
  const branch = followBranch(policy)
  if (branch) return `Follows ${branch}`
  return { manual: 'Manual', patches: 'Patches', minor: 'Minor releases' }[policy] ?? policy
}

/** One-line summary of an update window: "Mon, Tue 02:00-04:00 Europe/Berlin". */
export function windowText(w: NonNullable<AppPlan['updateWindow']>): string {
  const names = WEEKDAYS.filter((d) => w.days.includes(d.n)).map((d) => d.label)
  const days = names.length === 7 ? 'Every day' : names.join(', ')
  return w.start === w.end
    ? `${days}, all day (${w.timeZone})`
    : `${days} ${w.start}-${w.end} (${w.timeZone})`
}
