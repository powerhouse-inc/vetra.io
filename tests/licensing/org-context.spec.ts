import { expect, test, type Page } from '@playwright/test'
import { logIn, routeRenown } from './fixtures/auth'
import { mockCloud, unexpectedCalls } from './fixtures/cloud-mock'
import { app, baseState, ME } from './fixtures/data'
import { routeRenownOrgs } from './fixtures/renown-orgs'

const ACME = { id: 'org-acme', name: 'Acme Robotics', handle: 'acme', role: 'ADMIN' as const }

function orgState() {
  const s = baseState()
  s.orgApps[ACME.id] = [{ ...app('app-robot', 'Robot Control'), ownerOrgId: ACME.id }]
  s.orgEnvironments = [
    {
      id: 'env-acme',
      name: 'Acme staging',
      subdomain: 'acme-staging',
      tenantId: null,
      customDomain: null,
      status: 'READY',
      owner: ME,
      createdBy: ME,
      ownerOrgId: ACME.id,
      packages: [],
      services: [],
    },
  ]
  return s
}

async function switchTo(page: Page, name: RegExp) {
  await page.locator('button[aria-haspopup="menu"]:has([data-slot="avatar"])').first().click()
  await page.getByRole('menuitemradio', { name }).click()
}

test.describe('organisation context', () => {
  test.skip(
    ({ isMobile }) => isMobile,
    'the account menu with the switcher sits in the desktop navbar',
  )

  test('switching to an organisation shows its apps and environments and survives a reload', async ({
    page,
  }) => {
    const s = orgState()
    await routeRenown(page)
    await routeRenownOrgs(page, [ACME])
    await mockCloud(page, s)
    await logIn(page)

    await page.goto('/user')
    await expect(page.getByText('Knowledge Vault')).toBeVisible()
    await switchTo(page, /Acme Robotics/)
    await expect(page.getByText('Robot Control')).toBeVisible()
    await expect(page.getByText('Knowledge Vault')).toHaveCount(0)
    await expect(page.getByText(/Apps of\s+Acme Robotics/)).toBeVisible()

    await page.goto('/user/environments')
    await expect(page.getByText('Acme staging')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Acme staging')).toBeVisible()
    expect(unexpectedCalls(s)).toStrictEqual([])

    await switchTo(page, /Personal/)
    await expect(page.getByText('Acme staging')).toHaveCount(0)
  })

  test('without Renown the switcher offers only Personal and the lists still load', async ({
    page,
  }) => {
    const s = orgState()
    await routeRenown(page)
    await routeRenownOrgs(page, 'offline')
    await mockCloud(page, s)
    await logIn(page)
    await page.evaluate(() => window.localStorage.setItem('vetra.activeOrg', 'org-acme'))
    await page.goto('/user')
    await expect(page.getByText('Knowledge Vault')).toBeVisible()
    await page.locator('button[aria-haspopup="menu"]:has([data-slot="avatar"])').first().click()
    await expect(page.getByRole('menuitemradio')).toHaveCount(1)
  })
})
