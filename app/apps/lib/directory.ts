import { fetchAppProfile } from '@/modules/apps/lib/app-profile/api'
import { profileLogoUrl } from '@/modules/apps/lib/app-profile/logo'
import { appPageUrl } from '@/modules/apps/lib/app-profile/renown'
import { getCloudEndpoint } from '@/modules/cloud/graphql'

/** How long the page reuses what it read (seconds). */
export const APPS_REVALIDATE = 600

/** One app on /apps: Vetra's ranking (holders) with its Renown profile when it has one. */
export type DirectoryApp = {
  appId: string
  /** The app's Renown identity; seeds its generated avatar when it has no logo. */
  appDid: string | null
  name: string
  holders: number
  plans: number
  tagline: string | null
  category: string | null
  logoUrl: string | null
  /** Its page on Renown; null without a profile. */
  pageUrl: string | null
}

type Ranked = { appId: string; name: string; appDid: string | null; holders: number; plans: number }

const cachedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, next: { revalidate: APPS_REVALIDATE } })

async function fetchRanking(fetchImpl: typeof fetch): Promise<Ranked[]> {
  const res = await fetchImpl(getCloudEndpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: '{ vetraSubscriptions { directory { appId name appDid holders plans } } }',
    }),
  })
  const body = (await res.json().catch(() => null)) as {
    data?: { vetraSubscriptions?: { directory?: Ranked[] } }
    errors?: { message?: string }[]
  } | null
  const list = body?.data?.vetraSubscriptions?.directory
  if (!res.ok || !list)
    throw new Error(body?.errors?.[0]?.message ?? `directory answered ${res.status}`)
  return list
}

/**
 * The apps anyone can get, most held first (the server's order). Renown adds name, tagline,
 * category and logo; an app whose profile cannot be read is still listed, plainly.
 */
export async function loadAppsDirectory(
  fetchImpl: typeof fetch = cachedFetch,
): Promise<DirectoryApp[]> {
  const ranked = await fetchRanking(fetchImpl)
  return Promise.all(
    ranked.map(async (app): Promise<DirectoryApp> => {
      const profile = app.appDid
        ? await fetchAppProfile(app.appDid, fetchImpl).catch(() => null)
        : null
      return {
        appId: app.appId,
        appDid: app.appDid,
        name: profile?.name?.trim() || app.name,
        holders: app.holders,
        plans: app.plans,
        tagline: profile?.tagline ?? null,
        category: profile?.category ?? null,
        logoUrl: profile ? profileLogoUrl(profile) : null,
        pageUrl: profile && app.appDid ? appPageUrl(app.appDid) : null,
      }
    }),
  )
}
