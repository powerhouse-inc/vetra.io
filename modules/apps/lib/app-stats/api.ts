import { renownStatsEndpoint } from '../app-profile/renown'

export type MetricAggregation = 'SUM' | 'MAX' | 'AVG' | 'COUNT_USERS'

/** One public metric's headline (renown-stats AppMetricStat, without contributors). */
export type AppMetricStat = {
  key: string
  label: string
  unit: string | null
  aggregation: MetricAggregation
  value: number
  users: number
}

export type AppStats = {
  appDid: string
  activeUsers30d: number
  totalUsers: number
  metrics: AppMetricStat[]
  updatedAt: string | null
}

const QUERY = `query AppStats($appDid: String!) { appStats(appDid: $appDid) { appDid activeUsers30d totalUsers updatedAt metrics { key label unit aggregation value users } } }`

type Body = { data?: { appStats?: AppStats | null } | null; errors?: { message?: string }[] }

/** The app's public stats on Renown, or null when Renown knows nothing of it yet. Public; no token. */
export async function fetchAppStats(
  appDid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AppStats | null> {
  const res = await fetchImpl(renownStatsEndpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { appDid } }),
  })
  const body = (await res.json().catch(() => null)) as Body | null
  const error = body?.errors?.[0]
  if (error || !res.ok) throw new Error(error?.message ?? `Renown answered ${res.status}`)
  return body?.data?.appStats ?? null
}
