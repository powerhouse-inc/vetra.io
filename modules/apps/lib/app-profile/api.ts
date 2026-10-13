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
}

const FIELDS = `appDid documentId name tagline logo website publisherDid description category logoRef coverRef links { id label url } metrics { id key label unit description aggregation public }`
const CONTACT_FIELDS = ' supportContact securityContact'

let renownHasContacts = true
/** False once Renown has answered that it lacks the contact fields (Renown < 1.12). */
export function renownSupportsContacts(): boolean {
  return renownHasContacts
}


type Body = {
  data?: { appProfile?: RenownAppProfile | null } | null
  errors?: { message?: string }[]
}

const lacksField = (message: string | undefined) => !!message && /Cannot query field/i.test(message)

async function query(
  fields: string,
  appDid: string,
  fetchImpl: typeof fetch,
): Promise<{ profile: RenownAppProfile | null; missingField: boolean }> {
  const res = await fetchImpl(renownStatsEndpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `query AppProfile($appDid: String!) { appProfile(appDid: $appDid) { ${fields} } }`,
      variables: { appDid },
    }),
  })
  const body = (await res.json().catch(() => null)) as Body | null
  const error = body?.errors?.[0]
  if (lacksField(error?.message)) return { profile: null, missingField: true }
  if (error || !res.ok) throw new Error(error?.message ?? `Renown answered ${res.status}`)
  return { profile: body?.data?.appProfile ?? null, missingField: false }
}

/**
 * The app's Renown profile, or null when it has none yet. Public; no token.
 * A Renown without the contact fields ("Cannot query field") is asked again without them.
 */
export async function fetchAppProfile(
  appDid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RenownAppProfile | null> {
  const first = await query(FIELDS + CONTACT_FIELDS, appDid, fetchImpl)
  if (!first.missingField) {
    renownHasContacts = true
    return first.profile
  }
  renownHasContacts = false
  const { profile } = await query(FIELDS, appDid, fetchImpl)
  return profile ? { ...profile, contactsUnavailable: true } : null
}
