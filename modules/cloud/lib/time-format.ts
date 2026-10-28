/**
 * Countdown and byte-formatting helpers for the Database tab UI. Relative past
 * times ("3 minutes ago") come from the shared `@/modules/shared/lib/time`.
 */

/** Compact relative-future formatter; returns `'expired'` for past dates. */
export function timeUntil(iso: string): string {
  const d = new Date(iso).getTime() - Date.now()
  if (d < 0) return 'expired'
  const m = Math.round(d / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const remM = m % 60
  if (h < 48) return remM > 0 ? `${h}h ${remM}m` : `${h}h`
  return `${Math.round(h / 24)}d`
}

/** Byte-count formatter ("1.2 MB", "340 KB"). Empty string for null/0. */
export function fmtBytes(n: number | null): string {
  if (n === null || n === 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}
