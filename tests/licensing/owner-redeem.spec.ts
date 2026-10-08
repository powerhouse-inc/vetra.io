import { expect, test } from '@playwright/test'
import { logIn, routeRenown, snap } from './fixtures/auth'
import { mockCloud, unexpectedCalls } from './fixtures/cloud-mock'
import { baseState } from './fixtures/data'

test('owner: redeem → subscription → environment', async ({ page }) => {
  const state = baseState()
  await routeRenown(page)
  await mockCloud(page, state)

  await page.goto('/redeem/KV-PILOT')
  await expect(page.getByRole('heading', { name: 'Knowledge Vault' })).toBeVisible()
  await snap(page, 'redeem-before-login')
  await logIn(page, '/redeem/KV-PILOT')

  await page.getByLabel('Project name').fill('Acme research')
  await snap(page, 'redeem-setup')
  await page.getByRole('button', { name: 'Get access' }).click()

  await expect(page).toHaveURL(/\/user\/subscriptions\?highlight=lic-1$/)
  const card = page.getByTestId('subscription-lic-1')
  await expect(card).toHaveAttribute('data-highlighted', 'true')
  await expect(card).toContainText('Pilot')
  await expect(card.getByRole('link', { name: /open/i })).toHaveAttribute(
    'href',
    'https://acme.kv.vetra.io',
  )
  await snap(page, 'subscriptions')
  await card.getByRole('link', { name: 'Acme research' }).click()
  await expect(page).toHaveURL(/\/user\/environments\/env-kv-1$/)
  // The environment page names the environment and says which app and plan it comes with.
  await expect(
    page.getByRole('status').filter({ hasText: 'Knowledge Vault · Pilot' }),
  ).toContainText('This environment comes with your Pilot licence for Knowledge Vault.')
  await expect(page.getByText('Acme research').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'View subscription' })).toHaveAttribute(
    'href',
    /\/user\/subscriptions\?highlight=lic-1$/,
  )
  await snap(page, 'environment')
  expect(unexpectedCalls(state)).toEqual([])
})

test('owner: an invalid code says so before asking to log in', async ({ page }) => {
  const state = baseState()
  await routeRenown(page)
  await mockCloud(page, state)
  await page.goto('/redeem/NOPE')
  await expect(page.getByText('This code can’t be used')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log in with Renown' })).toHaveCount(0)
  await snap(page, 'redeem-invalid')
  expect(unexpectedCalls(state)).toEqual([])
})

test('owner: holding a licence offers the upgrade instead of a second environment', async ({
  page,
}) => {
  const state = baseState()
  state.subscriptions.push({
    licenseId: 'lic-free',
    appId: 'app-kv',
    appName: 'Knowledge Vault',
    kind: 'kv-free',
    termLabel: 'Free',
    issuer: 'INVITE_CODE',
    status: 'ACTIVE',
    start: '2026-10-01T00:00:00Z',
    end: null,
    mode: 'DEDICATED',
    environmentId: 'env-kv-0',
    environmentLabel: 'Acme',
    openUrl: null,
    stoppedAt: null,
    deleteAfter: null,
    warnings: [],
  })
  await routeRenown(page)
  await mockCloud(page, state)
  await logIn(page, '/redeem/KV-PILOT')

  await page.getByRole('radio', { name: 'Upgrade Free' }).click()
  await expect(page.getByLabel('Project name')).toHaveCount(0)
  await snap(page, 'redeem-upgrade')
  await page.getByRole('button', { name: 'Get access' }).click()
  await expect(page).toHaveURL(/highlight=lic-2$/)
  const redeem = state.calls.find((c) => c.query.includes('redeemInviteCode(input: $input)'))
  expect(redeem?.variables).toEqual({ input: { code: 'KV-PILOT', upgrades: 'lic-free' } })
  expect(unexpectedCalls(state)).toEqual([])
})
