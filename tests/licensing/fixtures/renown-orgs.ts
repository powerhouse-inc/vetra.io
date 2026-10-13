import type { Page } from '@playwright/test'

const ORGS_URL = 'https://switchboard.renown.vetra.io/graphql/renown-orgs'

type Org = { id: string; name: string; handle: string; role: 'OWNER' | 'ADMIN' | 'PUBLISHER' | 'MEMBER' }

/** Renown's renown-orgs answers (register after routeRenown so this route wins). */
export async function routeRenownOrgs(page: Page, orgs: Org[] | 'offline'): Promise<void> {
  await page.route(ORGS_URL, async (route) => {
    if (orgs === 'offline') return route.fulfill({ status: 503, body: 'down' })
    const { query = '', variables = {} } = (route.request().postDataJSON() ?? {}) as {
      query?: string
      variables?: Record<string, string>
    }
    const summary = (o: Org) => ({ id: o.id, did: `did:web:www.renown.id:org:${o.id}`, handle: o.handle, name: o.name, avatar: null, verifiedDomains: [] })
    if (query.includes('organizationsByMember')) {
      return route.fulfill({
        json: { data: { organizationsByMember: orgs.map((o) => ({ role: o.role, org: { ...summary(o), archived: false, takenDown: false } })) } },
      })
    }
    if (query.includes('organization(')) {
      const o = orgs.find((x) => x.id === variables.id)
      return route.fulfill({ json: { data: { organization: o ? summary(o) : null } } })
    }
    return route.fulfill({ json: { data: null, errors: [{ message: 'not mocked' }] } })
  })
}
