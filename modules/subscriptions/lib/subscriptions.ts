import type { StatusMeta } from '@/modules/apps/lib/status'
import { formatDate } from '@/modules/apps/lib/time'
import type { Subscription, SubscriptionWarningKind } from '../types'

const LIVE = new Set(['ISSUED', 'ACTIVE'])
export const isLive = (s: Pick<Subscription, 'status'>): boolean => LIVE.has(s.status)

export type AppGroup = { appId: string; appName: string; live: Subscription[]; past: Subscription[] }

const startTime = (s: Subscription) => (s.start ? new Date(s.start).getTime() : Number.POSITIVE_INFINITY)

export function groupByApp(subs: Subscription[]): AppGroup[] {
  const groups = new Map<string, AppGroup>()
  for (const s of subs) {
    const g = groups.get(s.appId) ?? { appId: s.appId, appName: s.appName, live: [], past: [] }
    ;(isLive(s) ? g.live : g.past).push(s)
    groups.set(s.appId, g)
  }
  const byStart = (a: Subscription, b: Subscription) => startTime(b) - startTime(a) || 0
  return [...groups.values()]
    .map((g) => ({ ...g, live: g.live.sort(byStart), past: g.past.sort(byStart) }))
    .sort((a, b) => {
      if ((a.live.length > 0) !== (b.live.length > 0)) return a.live.length > 0 ? -1 : 1
      return a.appName.localeCompare(b.appName)
    })
}

const STATUS: Record<string, StatusMeta> = {
  ISSUED: { label: 'Setting up', tone: 'progress', active: true },
  ACTIVE: { label: 'Active', tone: 'success', active: false },
  EXPIRED: { label: 'Expired', tone: 'warning', active: false },
  // Owner-facing: whether the publisher revoked it or the owner cancelled, it has ended.
  REVOKED: { label: 'Ended', tone: 'neutral', active: false },
  REPLACED: { label: 'Upgraded', tone: 'neutral', active: false },
}
export const subscriptionStatusMeta = (status: string): StatusMeta =>
  STATUS[status] ?? { label: status, tone: 'neutral', active: false }

export const subscriptionName = (s: Pick<Subscription, 'termLabel' | 'kind'>): string =>
  s.termLabel?.trim() || s.kind

export function issuerText(issuer: string): string {
  if (issuer === 'INVITE_CODE') return 'From an invite code'
  if (issuer === 'PUBLISHER_GRANT') return 'Given to you by the publisher'
  if (issuer === 'ACHRA_SUBSCRIPTION') return 'Paid subscription'
  return issuer
}

export function validityLine(s: Subscription, now: Date = new Date()): string {
  if (!isLive(s)) return s.end ? `Ended ${formatDate(s.end)}` : 'Ended'
  if (!s.start) return 'Starting now'
  const until = s.end
    ? new Date(s.end).getTime() > now.getTime()
      ? `until ${formatDate(s.end)}`
      : `ended ${formatDate(s.end)}`
    : 'no end date'
  return `Since ${formatDate(s.start)} · ${until}`
}

export function warningTone(kind: SubscriptionWarningKind): 'warning' | 'danger' {
  return kind === 'STOPPED_DELETE_PENDING' || kind === 'DELETE_IMMINENT' ? 'danger' : 'warning'
}

/** Only a live licence of the same app can be upgraded in place. */
export function upgradeCandidates(subs: Subscription[], appId: string): Subscription[] {
  return subs.filter((s) => s.appId === appId && isLive(s))
}

export const environmentHref = (s: Pick<Subscription, 'environmentId'>): string | null =>
  s.environmentId ? `/user/environments/${s.environmentId}` : null

export const subscriptionHref = (licenseId: string): string =>
  `/user/subscriptions?highlight=${encodeURIComponent(licenseId)}`
