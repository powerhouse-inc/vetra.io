import { expect, test } from '@playwright/test'

test.describe('console landing pages', () => {
  for (const path of ['/', '/cloud', '/studio']) {
    test(`${path} has no horizontal scroll at 360px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 })
      await page.goto(path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }

  test('logged-out /user/studio lands on the Studio page', async ({ page }) => {
    await page.goto('/user/studio')
    await expect(page).toHaveURL(/\/studio$/)
  })
})
