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

test('owner: holding another plan offers an explicit switch', async ({ page }) => {
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

  // Switching a live licence to another plan is never chosen for them.
  const getAccess = page.getByRole('button', { name: 'Get access' })
  await expect(getAccess).toBeDisabled()
  await snap(page, 'redeem-switch-choose')
  await page.getByRole('radio', { name: 'Switch Free to Pilot' }).click()
  await expect(page.getByLabel('Project name')).toHaveCount(0)
  await snap(page, 'redeem-upgrade')
  await page.getByRole('button', { name: 'Get access' }).click()
  await expect(page).toHaveURL(/highlight=lic-2$/)
  const redeem = state.calls.find((c) => c.query.includes('redeemInviteCode(input: $input)'))
  expect(redeem?.variables).toEqual({ input: { code: 'KV-PILOT', upgrades: 'lic-free' } })
  expect(unexpectedCalls(state)).toEqual([])
})

test('owner: a code for the plan already held renews it', async ({ page }) => {
  const state = baseState()
  const held = {
    appId: 'app-kv',
    appName: 'Knowledge Vault',
    issuer: 'INVITE_CODE',
    end: null,
    mode: 'DEDICATED' as const,
    openUrl: null,
    stoppedAt: null,
    deleteAfter: null,
    warnings: [],
  }
  state.subscriptions.push(
    {
      ...held,
      licenseId: 'lic-pilot',
      kind: 'kv-pilot',
      termLabel: 'Pilot',
      status: 'ACTIVE',
      start: '2026-10-01T00:00:00Z',
      environmentId: 'env-kv-1',
      environmentLabel: 'Acme research',
    },
    // Still being set up: the server cannot upgrade it, so it is never offered.
    {
      ...held,
      licenseId: 'lic-setup',
      kind: 'kv-team',
      termLabel: 'Team',
      status: 'ISSUED',
      start: null,
      environmentId: null,
      environmentLabel: null,
    },
  )
  await routeRenown(page)
  await mockCloud(page, state)
  await logIn(page, '/redeem/KV-PILOT')

  await expect(page.getByRole('radio', { name: 'Renew Pilot' })).toBeChecked()
  await expect(page.getByRole('radio')).toHaveCount(2) // Renew Pilot, Start something new
  await snap(page, 'redeem-renew')
  await page.getByRole('button', { name: 'Get access' }).click()
  await expect(page).toHaveURL(/highlight=lic-3$/)
  const redeem = state.calls.find((c) => c.query.includes('redeemInviteCode(input: $input)'))
  expect(redeem?.variables).toEqual({ input: { code: 'KV-PILOT', upgrades: 'lic-pilot' } })
  expect(state.refusals).toEqual([])
  expect(unexpectedCalls(state)).toEqual([])
})
