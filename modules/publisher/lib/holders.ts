import type {
  PublisherAllowListEntry,
  PublisherEnvironment,
  PublisherLicense,
  PublisherTemplate,
  PublisherTerm,
  TemplateMode,
} from '../types'

/** What the server accepts for `user`; every other DID method is refused (UNSUPPORTED_DID). */
export const USER_PATTERN = /^(0x[0-9a-fA-F]{40}|did:pkh:eip155:\d+:0x[0-9a-fA-F]{40})$/

const PKH = /^did:pkh:eip155:\d+:(0x[0-9a-fA-F]{40})$/i

/** Lowercased wallet address behind a DID or bare address; null for other DIDs. */
export function addressOf(user: string): string | null {
  const trimmed = user.trim()
  const fromPkh = PKH.exec(trimmed)?.[1]
  if (fromPkh) return fromPkh.toLowerCase()
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? trimmed.toLowerCase() : null
}

export function sameUser(a: string, b: string): boolean {
  const aa = addressOf(a)
  const bb = addressOf(b)
  if (aa && bb) return aa === bb
  return a.trim() === b.trim()
}

export type HolderRow = PublisherLicense & { environment: PublisherEnvironment | null }

const LIVE = new Set(['ISSUED', 'ACTIVE'])
const isLive = (l: Pick<PublisherLicense, 'status'>) => LIVE.has(l.status)

export function joinHolders(
  licenses: PublisherLicense[],
  environments: PublisherEnvironment[],
): HolderRow[] {
  const rows = licenses.map((l) => ({
    ...l,
    environment:
      environments.find((e) => e.licenseId === l.id) ??
      (l.environmentId
        ? (environments.find((e) => e.environmentId === l.environmentId) ?? null)
        : null),
  }))
  const time = (s: string | null) => (s ? new Date(s).getTime() : Number.POSITIVE_INFINITY)
  return rows.sort((a, b) => {
    if (isLive(a) !== isLive(b)) return isLive(a) ? -1 : 1
    // `|| 0`: two open-ended starts give Infinity - Infinity = NaN.
    return time(b.start) - time(a.start) || 0
  })
}

export const LICENSE_FILTERS = [
  'ALL',
  'ISSUED',
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'REPLACED',
] as const
export type LicenseFilter = (typeof LICENSE_FILTERS)[number]

export function filterHolders(
  rows: HolderRow[],
  { status, kind, query }: { status: LicenseFilter; kind: string; query: string },
): HolderRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter(
    (r) =>
      (status === 'ALL' || r.status === status) &&
      (kind === 'ALL' || r.kind === kind) &&
      (q === '' ||
        r.user.toLowerCase().includes(q) ||
        (r.environment?.label ?? '').toLowerCase().includes(q)),
  )
}

export function liveLicenseOf(
  licenses: PublisherLicense[],
  user: string,
): PublisherLicense | undefined {
  return licenses.find((l) => isLive(l) && sameUser(l.user, user))
}

export function isOnAllowList(entries: PublisherAllowListEntry[], user: string): boolean {
  return entries.some((e) => sameUser(e.user, user))
}

/** Published plans that allow a publisher grant — the only ones issueGrant/replaceGrant accept. */
export function grantablePlans(terms: PublisherTerm[]): PublisherTerm[] {
  return terms.filter((t) => t.status === 'ACTIVE' && t.issuers.includes('PUBLISHER_GRANT'))
}

export function modeOfKind(
  kind: string,
  terms: Pick<PublisherTerm, 'kind' | 'templateId'>[],
  templates: Pick<PublisherTemplate, 'id' | 'mode'>[],
): TemplateMode | null {
  const term = terms.find((t) => t.kind === kind)
  return templates.find((t) => t.id === term?.templateId)?.mode ?? null
}

/**
 * The server moves a licence to another plan only from the newest licence of its chain, and only
 * while it is ACTIVE, EXPIRED or REVOKED (an ISSUED one is still being set up).
 */
const PLAN_CHANGEABLE = new Set(['ACTIVE', 'EXPIRED', 'REVOKED'])
export function canChangePlan(l: Pick<PublisherLicense, 'status' | 'replacedBy'>): boolean {
  return l.replacedBy == null && PLAN_CHANGEABLE.has(l.status)
}

/** Plans a licence can move to: an ACTIVE licence cannot "move" to the plan it already has. */
export function changePlanTargets(
  terms: PublisherTerm[],
  l: Pick<PublisherLicense, 'status' | 'kind'>,
): PublisherTerm[] {
  return grantablePlans(terms).filter((t) => l.status !== 'ACTIVE' || t.kind !== l.kind)
}
