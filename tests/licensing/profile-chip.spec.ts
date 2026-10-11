import { expect, test, type Page } from '@playwright/test'
import { logIn, routeRenown } from './fixtures/auth'
import { mockCloud } from './fixtures/cloud-mock'
import { baseState } from './fixtures/data'

const RENOWN_SWITCHBOARD = 'https://switchboard.renown.vetra.io/graphql'
const SHA = 'ab12'.repeat(16)
// 1×1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

/** Answers vetra.io's avatar lookup (after the generic Renown mocks, so it wins). */
async function routeAvatar(
  page: Page,
  row: { documentId: string; avatar: string | null; userImage: string | null } | null,
  media: 'ok' | 'broken' = 'ok',
): Promise<void> {
  await page.route(RENOWN_SWITCHBOARD, async (route) => {
    const query = (route.request().postDataJSON() as { query?: string } | null)?.query ?? ''
    if (!query.includes('VetraRenownAvatar')) return route.fallback()
    return route.fulfill({ json: { data: { renownUsers: row ? [row] : [] } } })
  })
  await page.route('https://www.renown.id/media/**', (route) =>
    media === 'ok'
      ? route.fulfill({ contentType: 'image/png', body: PNG })
      : route.fulfill({ status: 404, body: 'not found' }),
  )
}

type AvatarArgs = Parameters<typeof routeAvatar> extends [Page, ...infer Rest] ? Rest : never

/** The header's account chip (desktop navbar). */
const chip = (page: Page) =>
  page.locator('button[aria-haspopup="menu"]:has([data-slot="avatar"])').first()
/** The fixed navbar bar around it, for screenshots. */
const navbar = (page: Page) =>
  chip(page).locator('xpath=ancestor::div[contains(@class, "fixed")][1]')

async function setUp(page: Page, ...avatar: AvatarArgs) {
  await routeRenown(page)
  await mockCloud(page, baseState())
  await routeAvatar(page, ...avatar)
  await logIn(page)
}

test.describe('header profile chip', () => {
  test.skip(({ isMobile }) => isMobile, 'the chip sits in the desktop navbar')

  test('shows the avatar uploaded on renown.id', async ({ page }) => {
    await setUp(page, {
      documentId: 'e2e-profile',
      avatar: `attachment://v1:${SHA}`,
      userImage: null,
    })
    const img = chip(page).locator('img')
    await expect(img).toHaveAttribute(
      'src',
      'https://www.renown.id/media/e2e-profile/avatar?v=ab12ab12ab12',
    )
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1)
  })

  test('falls back to the icon when Renown has no image', async ({ page }) => {
    await setUp(page, { documentId: 'e2e-profile', avatar: null, userImage: 'ipfs://not-loadable' })
    await expect(chip(page)).toBeVisible()
    await expect(chip(page).locator('img')).toHaveCount(0)
    await expect(chip(page).locator('svg').first()).toBeVisible()
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await navbar(page).screenshot({
        path: `licensing-screens/${test.info().project.name}/profile-chip-fallback-${scheme}.png`,
        animations: 'disabled',
      })
    }
  })

  test('drops a broken avatar image and shows the fallback', async ({ page }) => {
    await setUp(
      page,
      { documentId: 'e2e-profile', avatar: `attachment://v1:${SHA}`, userImage: null },
      'broken',
    )
    await expect(chip(page)).toBeVisible()
    await expect(chip(page).locator('img')).toHaveCount(0)
    await expect(chip(page).locator('svg').first()).toBeVisible()
  })
})
