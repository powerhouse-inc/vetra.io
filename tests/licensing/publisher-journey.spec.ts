import { expect, test } from '@playwright/test'
import { logIn, routeRenown, snap } from './fixtures/auth'
import { mockCloud, unexpectedCalls } from './fixtures/cloud-mock'
import { baseState } from './fixtures/data'

test('publisher: template → plan → invite code, all on the app page', async ({ page }) => {
  const state = baseState()
  await routeRenown(page)
  await mockCloud(page, state)
  await logIn(page)

  await page.goto('/user/apps/app-vault')
  const tabs = [
    'Overview',
    'Deployments',
    'Artifacts',
    'Templates',
    'Plans',
    'Holders',
    'Invite codes',
    'Settings',
  ]
  for (const name of tabs) await expect(page.getByRole('tab', { name })).toBeVisible()
  await snap(page, 'app-overview')

  // Artifacts
  await page.getByRole('tab', { name: 'Artifacts' }).click()
  await expect(page.getByTestId('artifact-vault-app')).toContainText('Latest release')
  await snap(page, 'artifacts')

  // Template
  await page.getByRole('tab', { name: 'Templates' }).click()
  await page.getByRole('button', { name: 'Create your first template' }).click()
  await page.getByLabel('Name').fill('Pro workspace')
  await page.getByRole('radio', { name: 'Dedicated' }).click()
  await page.getByRole('button', { name: 'Create template' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: 'Pro workspace' })).toBeVisible()
  await sheet.getByRole('combobox', { name: 'Service type' }).click()
  await page.getByRole('option', { name: 'Your app image' }).click()
  await sheet.getByRole('combobox', { name: 'Image' }).click()
  await page.getByRole('option', { name: 'vault-app' }).click()
  await sheet.getByRole('button', { name: 'Add service' }).click()
  await expect(sheet.getByTestId('template-summary')).toContainText('Each owner gets vault-app')
  await snap(page, 'template-editor')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('template-tpl-1')).toContainText('Dedicated')

  // Plan
  await page.getByRole('tab', { name: 'Plans' }).click()
  await page.getByRole('button', { name: 'Create your first plan' }).click()
  await page.getByLabel('Name').fill('Conference 2026')
  await expect(page.getByLabel('Plan ID')).toHaveValue('conference-2026')
  await page.getByRole('combobox', { name: 'Template' }).click()
  await page.getByRole('option', { name: /Pro workspace/ }).click()
  await page.getByLabel('Valid for (days)').fill('30')
  await page.getByRole('button', { name: 'Create plan' }).click()
  const plan = page.getByTestId('plan-term-1')
  await plan.getByRole('button', { name: 'Publish' }).click()
  await page.getByRole('button', { name: 'Publish plan' }).click()
  await expect(plan).toContainText('Published')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await snap(page, 'plans')

  // Invite code
  await page.getByRole('tab', { name: 'Invite codes' }).click()
  await page.getByRole('button', { name: 'New invite code' }).click()
  await page.getByRole('combobox', { name: 'Plan' }).click()
  await page.getByRole('option', { name: 'Conference 2026' }).click()
  await page.getByLabel('Custom code (optional)').fill('LFC-2026')
  await page.getByLabel('Maximum uses').fill('50')
  await page.getByRole('button', { name: 'Create code' }).click()
  await expect(page.getByText('Your code is ready')).toBeVisible()
  await expect(page.getByText(/\/redeem\/LFC-2026$/)).toBeVisible()
  await snap(page, 'invite-code-created')

  // The server saw contract-shaped writes.
  const input = (field: string) =>
    state.calls.find((c) => c.query.includes(`${field}(input: $input)`))?.variables.input
  expect(input('addTemplate')).toEqual({
    appId: 'app-vault',
    name: 'Pro workspace',
    mode: 'DEDICATED',
  })
  expect(input('addTerm')).toEqual({
    appId: 'app-vault',
    kind: 'conference-2026',
    label: 'Conference 2026',
    templateId: 'tpl-1',
    validityDays: 30,
    issuers: ['INVITE_CODE'],
  })
  expect(input('createInviteCode')).toEqual({
    appId: 'app-vault',
    kind: 'conference-2026',
    label: null,
    maxUses: 50,
    expiresAt: null,
    code: 'LFC-2026',
  })
  expect(unexpectedCalls(state)).toEqual([])
})

test('the old Licensing URL lands on the app page', async ({ page }) => {
  const state = baseState()
  await routeRenown(page)
  await mockCloud(page, state)
  await logIn(page)
  await page.goto('/user/publisher?app=app-vault')
  await expect(page).toHaveURL(/\/user\/apps\/app-vault\?tab=plans$/)
  await expect(page.getByRole('tab', { name: 'Plans', selected: true })).toBeVisible()
  expect(unexpectedCalls(state)).toEqual([])
})
