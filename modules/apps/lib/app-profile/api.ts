import { renownStatsEndpoint } from './renown'

export type RenownAppLink = { id: string; label: string; url: string }

/** A publisher-defined metric (renown-stats AppMetric). */
export type RenownAppMetric = {
  id: string
  key: string
  label: string
  unit: string | null
  description: string | null
  aggregation: 'SUM' | 'MAX' | 'AVG' | 'COUNT_USERS'
  public: boolean
}

/** An app's public profile as Renown serves it (renown-stats AppProfile). */
export type RenownAppProfile = {
  appDid: string
  /** Its images are at <renown>/media/<documentId>/logo and /cover. */
  documentId: string
  name: string | null
  tagline: string | null
  /** Legacy logo URL; prefer logoRef. */
  logo: string | null
  website: string | null
  publisherDid: string | null
  description: string | null
  category: string | null
  logoRef: string | null
  coverRef: string | null
  links: RenownAppLink[]
  /** Absent from Renown before identity hub phase 3. */
  metrics?: RenownAppMetric[]
  /** Absent from Renown before organisations (A3). */
  supportContact?: string | null
  securityContact?: string | null
  /** Set when Renown predates the contact fields; the tab hides them. */
  contactsUnavailable?: true
  /** Set when Renown predates metrics; the tab hides the editor. */
  metricsUnavailable?: true
}

const BASE_FIELDS = `appDid documentId name tagline logo website publisherDid description category logoRef coverRef links { id label url }`
const METRIC_FIELDS = ' metrics { id key label unit description aggregation public }'
const CONTACT_FIELDS = ' supportContact securityContact'

type Optional = 'metrics' | 'contacts'
const missing = new Set<Optional>()

/** False once Renown has answered that it lacks the contact fields (Renown < 1.12). */
export function renownSupportsContacts(): boolean {
  return !missing.has('contacts')
}
/** False once Renown has answered that it lacks the metrics field (before identity hub phase 3). */
export function renownSupportsMetrics(): boolean {
  return !missing.has('metrics')
}

const fieldsWithout = (skip: ReadonlySet<Optional>) =>
  BASE_FIELDS +
  (skip.has('metrics') ? '' : METRIC_FIELDS) +
  (skip.has('contacts') ? '' : CONTACT_FIELDS)

type Body = {
  data?: { appProfile?: RenownAppProfile | null } | null
  errors?: { message?: string }[]
}

/** The optional group a "Cannot query field" error names, or null for any other message. */
function missingGroup(message: string | undefined): Optional | null {
  const field = /Cannot query field "(\w+)"/i.exec(message ?? '')?.[1]
  if (field === 'metrics') return 'metrics'
  if (field === 'supportContact' || field === 'securityContact') return 'contacts'
  return null
}

/**
 * The app's Renown profile, or null when it has none yet. Public; no token.
 * A Renown without the contact or metrics fields ("Cannot query field") is asked again without them.
 */
export async function fetchAppProfile(
  appDid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RenownAppProfile | null> {
  const skip = new Set<Optional>()
  for (;;) {
    const res = await fetchImpl(renownStatsEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query AppProfile($appDid: String!) { appProfile(appDid: $appDid) { ${fieldsWithout(skip)} } }`,
        variables: { appDid },
      }),
    })
    const body = (await res.json().catch(() => null)) as Body | null
    const error = body?.errors?.[0]
    const group = missingGroup(error?.message)
    if (group && !skip.has(group)) {
      skip.add(group)
      continue
    }
    if (error || !res.ok) throw new Error(error?.message ?? `Renown answered ${res.status}`)
    missing.clear()
    for (const g of skip) missing.add(g)
    const profile = body?.data?.appProfile ?? null
    if (!profile || skip.size === 0) return profile
    return {
      ...profile,
      ...(skip.has('contacts') && { contactsUnavailable: true as const }),
      ...(skip.has('metrics') && { metricsUnavailable: true as const }),
    }
  }
}
