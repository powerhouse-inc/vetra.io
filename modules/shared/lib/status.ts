/**
 * The one status vocabulary for the console. Every status dot or pill (apps,
 * environments, studios, subscriptions, publisher) maps its domain state to a
 * `StatusMeta` and renders it with the shared StatusDot / StatusPill, so the
 * same tone always reads in the same colour.
 *
 * Tones:
 * - success  — running / done (theme `success`)
 * - progress — something is moving: deploying, syncing, provisioning (theme `info`)
 * - warning  — needs the user's attention but is not broken (theme `warning`)
 * - danger   — failed / down (theme `destructive`)
 * - neutral  — inactive: draft, stopped, sleeping, superseded (muted)
 */
export type StatusTone = 'success' | 'progress' | 'warning' | 'danger' | 'neutral'

export type StatusMeta = {
  label: string
  tone: StatusTone
  /** True while the state is still moving (pulse animation, usually polling). */
  active: boolean
}

/** Dot fill per tone. */
export const TONE_DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  progress: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  neutral: 'bg-muted-foreground/60',
}

/** Soft pill background + text per tone. */
export const TONE_BADGE: Record<StatusTone, string> = {
  success: 'bg-success/15 text-success',
  progress: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/15 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
}

/** Text colour per tone, for icons that sit next to a status. */
export const TONE_TEXT: Record<StatusTone, string> = {
  success: 'text-success',
  progress: 'text-info',
  warning: 'text-warning',
  danger: 'text-destructive',
  neutral: 'text-muted-foreground',
}

/** Fallback for a status string no mapping knows: show it as-is, neutral. */
export function unknownStatusMeta(status: string): StatusMeta {
  return { label: status, tone: 'neutral', active: false }
}
