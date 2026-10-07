import { formatDistanceStrict } from 'date-fns'

/** "3 min ago" from an ISO timestamp; empty string for missing/invalid input. */
export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (Math.abs(now.getTime() - date.getTime()) < 45_000) return 'just now'
  return `${formatDistanceStrict(date, now)} ago`
}

/** Absolute timestamp for tooltips/`title` attributes. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

/** "Oct 2, 2027" for dates shown in copy. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
