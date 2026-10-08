import { expect, test } from '@playwright/test'
import { logIn, routeRenown, snap } from './fixtures/auth'
import { mockCloud, unexpectedCalls } from './fixtures/cloud-mock'
import { baseState } from './fixtures/data'

test('publisher: manage the licensing-only Vetra Studio app from the apps list', async ({
  page,
}) => {
  const state = baseState()
  state.templates.push({
    id: 'tpl-studio',
    name: 'Studio seat',
    mode: 'SHARED',
    sharedEnvironment: null,
    size: null,
    baseDomain: null,
    packageRegistry: null,
    services: [],
    packages: [],
    templateHash: 'h-studio',
    environmentCount: 0,
  })
  state.terms.push({
    id: 'term-studio',
    kind: 'studio-early-access-30d',
    label: 'Early access',
    templateId: 'tpl-studio',
    validityDays: 30,
    issuers: ['INVITE_CODE'],
    status: 'ACTIVE',
    activeLicenses: 3,
  })
  await routeRenown(page)
  await mockCloud(page, state)
  await logIn(page)

  await page.goto('/user')
  const card = page.getByTestId('licensing-only-app-app-studio')
  await expect(card).toContainText('Licensing only')
  await snap(page, 'apps-home-licensing-only')
  await card.getByRole('link', { name: 'Vetra Studio', exact: true }).click()

  await expect(page).toHaveURL(/\/user\/apps\/app-studio\?tab=plans$/)
  await expect(page.getByRole('heading', { name: 'Vetra Studio', level: 1 })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Plans', selected: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Invite codes' })).toBeVisible()
  for (const absent of ['Overview', 'Deployments', 'Artifacts', 'Settings']) {
    await expect(page.getByRole('tab', { name: absent })).toHaveCount(0)
  }
  await expect(page.getByText('App not found')).toHaveCount(0)
  await expect(page.getByTestId('plan-term-studio')).toContainText('Early access')
  await snap(page, 'studio-app-plans')

  await page.getByRole('tab', { name: 'Invite codes' }).click()
  await page.getByRole('button', { name: 'New invite code' }).click()
  // The only plan that allows invite codes is chosen for them.
  await page.getByLabel('Custom code (optional)').fill('STUDIO-2026-A')
  await page.getByRole('button', { name: 'Create code' }).click()
  await expect(page.getByText('Your code is ready')).toBeVisible()
  await expect(page.getByText(/\/redeem\/STUDIO-2026-A$/)).toBeVisible()
  await snap(page, 'studio-app-code-created')

  const input = state.calls.find((c) => c.query.includes('createInviteCode(input: $input)'))
    ?.variables.input
  expect(input).toEqual({
    appId: 'app-studio',
    kind: 'studio-early-access-30d',
    label: null,
    maxUses: null,
    expiresAt: null,
    code: 'STUDIO-2026-A',
  })
  expect(state.refusals).toEqual(['NOT_FOUND'])
  expect(unexpectedCalls(state)).toEqual([])
})
