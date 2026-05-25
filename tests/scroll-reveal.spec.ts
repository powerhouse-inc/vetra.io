import { test, expect } from '@playwright/test'

test.describe('Scroll reveal animations', () => {
  test('sections become visible after scrolling into view', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Audience cards — stagger section
    const audienceSection = page.locator('section').filter({ hasText: "Who it's for" })
    await audienceSection.scrollIntoViewIfNeeded()
    await expect(audienceSection).toBeVisible()

    // WhyVetra — stagger section
    const whyVetraSection = page
      .locator('section')
      .filter({ hasText: 'Yours to run. Yours to own.' })
    await whyVetraSection.scrollIntoViewIfNeeded()
    await expect(whyVetraSection).toBeVisible()

    // PowerhouseStack — stagger section
    const stackSection = page.locator('section').filter({ hasText: 'Part of the Powerhouse Stack' })
    await stackSection.scrollIntoViewIfNeeded()
    await expect(stackSection).toBeVisible()

    // FAQ — whole-section
    const faqSection = page.locator('section').filter({ hasText: 'Frequently Asked Questions' })
    await faqSection.scrollIntoViewIfNeeded()
    await expect(faqSection).toBeVisible()
  })
})
