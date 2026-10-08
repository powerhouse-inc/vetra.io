import { expect, test } from '@playwright/test'
import { logIn, routeRenown } from './fixtures/auth'
import { mockCloud } from './fixtures/cloud-mock'
import { baseState } from './fixtures/data'

test('the mock adapter logs in and the proxy lets us into /user', async ({ page }) => {
  const state = baseState()
  await routeRenown(page)
  await mockCloud(page, state)
  await logIn(page)
  await page.goto('/user/subscriptions')
  await expect(page).toHaveURL(/\/user\/subscriptions$/)
  await expect(page.getByRole('heading', { name: 'Subscriptions' })).toBeVisible()
})
