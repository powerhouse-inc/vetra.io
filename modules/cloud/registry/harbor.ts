const REGISTRY_BASE = 'https://cr.vetra.io'

type TagsListResponse = { name?: string; tags?: string[] | null }
type TokenResponse = { token?: string }

function parseChallenge(
  header: string | null,
): { realm: string; service: string; scope: string } | null {
  if (!header) return null
  const get = (key: 'realm' | 'service' | 'scope') => {
    const match = header.match(new RegExp(`${key}="([^"]+)"`))
    return match ? match[1] : null
  }
  const realm = get('realm')
  const service = get('service')
  const scope = get('scope')
  if (!realm || !service || !scope) return null
  return { realm, service, scope }
}

export type HarborCredentials = { username: string; password: string }

async function listTags(image: string, authorization?: string): Promise<Response> {
  const url = `${REGISTRY_BASE}/v2/${image}/tags/list`
  const init: RequestInit = authorization ? { headers: { authorization } } : {}
  return fetch(url, init)
}

/**
 * List an image's tags. Public projects work anonymously (token challenge);
 * private ones (FUSION apps) need `creds` — a read-only Harbor robot.
 */
export async function fetchHarborTags(
  image: string,
  creds?: HarborCredentials | null,
): Promise<string[]> {
  try {
    const basic = creds
      ? `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`
      : undefined
    const first = await listTags(image, basic)

    if (first.ok) {
      const data = (await first.json()) as TagsListResponse
      return data.tags ?? []
    }

    if (first.status !== 401) {
      console.warn(`[harbor] unexpected status ${first.status} for ${image}`)
      return []
    }

    const challenge = parseChallenge(first.headers.get('www-authenticate'))
    if (!challenge) {
      console.warn(`[harbor] 401 without parseable Www-Authenticate for ${image}`)
      return []
    }

    const tokenUrl = new URL(challenge.realm)
    tokenUrl.searchParams.set('service', challenge.service)
    tokenUrl.searchParams.set('scope', challenge.scope)

    const tokenRes = await fetch(tokenUrl.toString())
    if (!tokenRes.ok) {
      console.warn(`[harbor] token endpoint returned ${tokenRes.status}`)
      return []
    }
    const { token } = (await tokenRes.json()) as TokenResponse
    if (!token) {
      console.warn('[harbor] token endpoint response missing token field')
      return []
    }

    const retry = await listTags(image, `Bearer ${token}`)
    if (!retry.ok) {
      console.warn(`[harbor] retry after token returned ${retry.status}`)
      return []
    }
    const data = (await retry.json()) as TagsListResponse
    return data.tags ?? []
  } catch (error) {
    console.error('[harbor] fetchHarborTags threw', error)
    return []
  }
}
