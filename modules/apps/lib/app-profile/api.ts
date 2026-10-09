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
}

const FIELDS = `appDid documentId name tagline logo website publisherDid description category logoRef coverRef links { id label url } metrics { id key label unit description aggregation public }`

type Body = {
  data?: { appProfile?: RenownAppProfile | null } | null
  errors?: { message?: string }[]
}

/** The app's Renown profile, or null when it has none yet. Public; no token. */
export async function fetchAppProfile(
  appDid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RenownAppProfile | null> {
  const res = await fetchImpl(renownStatsEndpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `query AppProfile($appDid: String!) { appProfile(appDid: $appDid) { ${FIELDS} } }`,
      variables: { appDid },
    }),
  })
  const body = (await res.json().catch(() => null)) as Body | null
  const error = body?.errors?.[0]
  if (error || !res.ok) throw new Error(error?.message ?? `Renown answered ${res.status}`)
  return body?.data?.appProfile ?? null
}
