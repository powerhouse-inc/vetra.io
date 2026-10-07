export type StatusTone = 'neutral' | 'positive' | 'warning' | 'danger'
export type StatusMeta = { label: string; tone: StatusTone }

export function tierStatusMeta(status: string): StatusMeta {
  switch (status) {
    case 'DRAFT': return { label: 'Draft', tone: 'neutral' }
    case 'ACTIVE': return { label: 'Active', tone: 'positive' }
    case 'RETIRED': return { label: 'Retired', tone: 'danger' }
    default: return { label: status, tone: 'neutral' }
  }
}

export function licenseStatusMeta(status: string): StatusMeta {
  switch (status) {
    case 'ISSUED': return { label: 'Issued', tone: 'neutral' }
    case 'ACTIVE': return { label: 'Active', tone: 'positive' }
    case 'EXPIRED': return { label: 'Expired', tone: 'warning' }
    case 'REVOKED': return { label: 'Revoked', tone: 'danger' }
    default: return { label: status, tone: 'neutral' }
  }
}

export const TONE_BADGE: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-destructive/10 text-destructive',
}
