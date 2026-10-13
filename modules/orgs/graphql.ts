import { renownSwitchboardOrigin } from '@/modules/apps/lib/app-profile/renown'
import type { MyOrg, OrgRole, OrgSummary } from './types'

/** renown-orgs GraphQL on the Renown switchboard. */
export function renownOrgsEndpoint(): string {
  return `${renownSwitchboardOrigin()}/graphql/renown-orgs`
}

const SUMMARY = 'id did handle name avatar verifiedDomains'

type GqlError = { message?: string; extensions?: { code?: string } }
type Body<T> = { data?: T | null; errors?: GqlError[] }
type Answer<T> = { status: number; body: Body<T> | null }

async function orgsGql<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string | null,
  fetchImpl: typeof fetch,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetchImpl(renownOrgsEndpoint(), {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  return { status: res.status, body: (await res.json().catch(() => null)) as Body<T> | null }
}

/** Renown refused the bearer: HTTP 401/403, or GraphQL FORBIDDEN/UNAUTHENTICATED (HTTP 200 with errors). */
function bearerRefused({ status, body }: Answer<unknown>): boolean {
  if (status === 401 || status === 403) return true
  return !!body?.errors?.some(
    (e) => e.extensions?.code === 'FORBIDDEN' || e.extensions?.code === 'UNAUTHENTICATED',
  )
}

function dataOrThrow<T>({ status, body }: Answer<T>): T {
  const message = body?.errors?.[0]?.message
  if (message) throw new Error(message)
  if (status >= 400 || !body?.data) throw new Error(`Renown answered ${status}`)
  return body.data
}

type Affiliation = { role: OrgRole; org: OrgSummary & { archived: boolean; takenDown: boolean } }

/**
 * The viewer's ACTIVE memberships (hidden ones too when Renown accepts the bearer).
 * When Renown refuses the bearer the read is retried once without it: the public
 * memberships only, i.e. the viewer is treated as signed out for viewer-specific data.
 */
export async function fetchMyOrganizations(
  address: string,
  token: string | null,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<MyOrg[]> {
  const query = `query VetraMyOrgs($address: String!) { organizationsByMember(address: $address) { role org { ${SUMMARY} archived takenDown } } }`
  let answer = await orgsGql<{ organizationsByMember: Affiliation[] }>(
    query,
    { address },
    token,
    fetchImpl,
  )
  if (token && bearerRefused(answer)) {
    answer = await orgsGql(query, { address }, null, fetchImpl)
  }
  return dataOrThrow(answer)
    .organizationsByMember.filter((a) => !a.org.archived && !a.org.takenDown)
    .map(({ role, org }) => ({
      id: org.id,
      did: org.did,
      handle: org.handle,
      name: org.name,
      avatar: org.avatar,
      verifiedDomains: org.verifiedDomains,
      role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Public data: no bearer is sent. */
export async function fetchOrganizationSummary(
  id: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<OrgSummary | null> {
  const query = `query VetraOrg($id: String!) { organization(id: $id) { ${SUMMARY} } }`
  return dataOrThrow(
    await orgsGql<{ organization: OrgSummary | null }>(query, { id }, null, fetchImpl),
  ).organization
}
