import { renownSwitchboardUrl } from '@/modules/shared/config/renown'

/**
 * Publisher links in the package directory. A publisher URL on a domain that a
 * Renown organisation proved it owns is followed; every other one is nofollow,
 * the same rule renown.id applies to organisation websites.
 */

const PAGE_SIZE = 50
/** Upper bound on organisation pages read per directory render. */
const MAX_PAGES = 20

/** The URL as an http(s) link, or null for anything else (javascript:, bare hosts, blanks). */
export function publisherHref(url: string | null | undefined): string | null {
  const value = url?.trim()
  if (!value) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

function bareDomain(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '')
}

/** True when `url` is on one of `verifiedDomains` or a subdomain of one. */
export function isVerifiedPublisherUrl(url: string, verifiedDomains: readonly string[]): boolean {
  if (!publisherHref(url)) return false
  const host = bareDomain(new URL(url.trim()).hostname)
  return verifiedDomains
    .map(bareDomain)
    .some((domain) => domain !== '' && (host === domain || host.endsWith(`.${domain}`)))
}

type OrgPage = {
  items: { verifiedDomains: string[]; archived: boolean; takenDown: boolean }[]
  next: string | null
}

function orgsEndpoint(): string {
  return `${renownSwitchboardUrl()
    .replace(/\/+$/, '')
    .replace(/\/graphql$/, '')}/graphql/renown-orgs`
}

const QUERY =
  'query VetraVerifiedPublishers($query: String, $limit: Int, $after: String) { organizationSearch(query: $query, limit: $limit, after: $after) { items { verifiedDomains archived takenDown } next } }'

/**
 * Verified domains of listed, active Renown organisations. Renown being down
 * yields an empty list, so every publisher link falls back to nofollow.
 */
export async function loadVerifiedDomains(): Promise<string[]> {
  const domains = new Set<string>()
  let after: string | null = null
  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const res = await fetch(orgsEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { query: '', limit: PAGE_SIZE, after } }),
        next: { revalidate: 600 },
      } as RequestInit)
      if (!res.ok) return []
      const body = (await res.json()) as { data?: { organizationSearch?: OrgPage } }
      const page = body.data?.organizationSearch
      if (!page) return []
      for (const org of page.items) {
        if (org.archived || org.takenDown) continue
        for (const domain of org.verifiedDomains) domains.add(bareDomain(domain))
      }
      if (!page.next || page.items.length === 0) break
      after = page.next
    }
  } catch {
    return []
  }
  return [...domains]
}
