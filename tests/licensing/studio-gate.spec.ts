import { expect, test } from '@playwright/test'
import { logIn, routeRenown, snap } from './fixtures/auth'
import { mockCloud, unexpectedCalls } from './fixtures/cloud-mock'
import { baseState } from './fixtures/data'

test('studio gate: no licence → redeem a studio code → the studio opens', async ({ page }) => {
  const state = baseState()
  state.studioAccess = { allowed: false, licenseId: null, expires: null, hasAttachedKey: false }
  // The one-time pre-alpha notice is not what this journey checks.
  await page.addInitScript(() => localStorage.setItem('vetra_prealpha_ack', '1'))
  await routeRenown(page)
  await mockCloud(page, state)
  await logIn(page)

  await page.goto('/user/studio')
  await expect(page.getByRole('heading', { name: 'Vetra Studio is in early access' })).toBeVisible()
  await snap(page, 'studio-no-licence')
  await page.getByRole('main').getByRole('link', { name: 'Redeem a code' }).first().click()
  await expect(page).toHaveURL(/\/redeem$/)

  await page.getByRole('textbox', { name: 'Invite code', exact: true }).fill('STUDIO-EARLY')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/redeem\/STUDIO-EARLY$/)
  await expect(page.getByRole('heading', { name: 'Vetra Studio' })).toBeVisible()
  await page.getByRole('button', { name: 'Get access' }).click()
  await expect(page).toHaveURL(/\/user\/subscriptions\?highlight=lic-1$/)

  await page.goto('/user/studio')
  await expect(page.getByRole('heading', { name: 'Studio', exact: true })).toBeVisible()
  await expect(page.getByText('No products yet')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Vetra Studio is in early access' })).toHaveCount(
    0,
  )
  await snap(page, 'studio-allowed')
  expect(state.refusals).toEqual([])
  expect(unexpectedCalls(state)).toEqual([])
})
