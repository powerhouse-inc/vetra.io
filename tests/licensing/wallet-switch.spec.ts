import { expect, test, type Page } from '@playwright/test'
import { logIn, routeRenown } from './fixtures/auth'
import { mockCloud } from './fixtures/cloud-mock'
import { baseState } from './fixtures/data'

/** The mock adapter's signer (the SDK's default test key, Hardhat account #0). */
const SIGNED_IN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const OTHER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const THIRD = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

/**
 * A stand-in for MetaMask's `window.ethereum`: holds the signed-in account and
 * lets the test switch accounts like the extension would. Pure test fixture; the
 * app reads any EIP-1193 provider found there.
 */
async function injectWallet(page: Page): Promise<void> {
  await page.addInitScript((initial) => {
    let accounts = [initial]
    const listeners = new Set<(a: string[]) => void>()
    const w = window as unknown as Record<string, unknown>
    w.ethereum = {
      isMetaMask: true,
      request: ({ method }: { method: string }) =>
        method === 'eth_accounts'
          ? Promise.resolve(accounts)
          : Promise.reject(new Error(`unsupported in e2e: ${method}`)),
      on: (event: string, fn: (a: string[]) => void) => {
        if (event === 'accountsChanged') listeners.add(fn)
      },
      removeListener: (_: string, fn: (a: string[]) => void) => listeners.delete(fn),
    }
    w.__e2eSwitchAccount = (next: string) => {
      accounts = [next]
      listeners.forEach((fn) => fn(accounts))
    }
  }, SIGNED_IN)
}

const switchAccount = (page: Page, next: string) =>
  page.evaluate(
    (a) => (window as unknown as { __e2eSwitchAccount(a: string): void }).__e2eSwitchAccount(a),
    next,
  )

async function setUp(page: Page): Promise<{ credentialsIssued: () => number }> {
  let issued = 0
  await injectWallet(page)
  await routeRenown(page)
  await mockCloud(page, baseState())
  // Counts sign-ins (credential issuance) without changing the generic answer.
  await page.route('https://switchboard.renown.vetra.io/graphql', async (route) => {
    const query = (route.request().postDataJSON() as { query?: string } | null)?.query ?? ''
    if (query.includes('renown_issueCredential')) issued += 1
    return route.fallback()
  })
  await logIn(page)
  return { credentialsIssued: () => issued }
}

test('asks before continuing when the wallet switches accounts', async ({ page }) => {
  const { credentialsIssued } = await setUp(page)
  await expect(page.getByRole('alertdialog')).toHaveCount(0)

  await switchAccount(page, OTHER)
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('You switched to 0x7099…79C8 in your wallet.')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.screenshot({
      path: `licensing-screens/${test.info().project.name}/wallet-switch-${scheme}.png`,
      animations: 'disabled',
    })
  }
  await page.emulateMedia({ colorScheme: 'light' })

  // Stay: the dialog goes away and the session is untouched.
  await dialog.getByRole('button', { name: 'Stay as 0xf39F…2266' }).click()
  await expect(dialog).toHaveCount(0)
  await switchAccount(page, OTHER)
  await expect(page.getByRole('alertdialog')).toHaveCount(0)

  // Another account: ask again. Sign in as it: log out, then a fresh wallet sign-in.
  await switchAccount(page, THIRD)
  await expect(dialog).toContainText('You switched to 0x3C44…93BC in your wallet.')
  const before = credentialsIssued()
  await dialog.getByRole('button', { name: 'Sign in as 0x3C44…93BC' }).click()
  await expect.poll(credentialsIssued).toBeGreaterThan(before)
})

test('also catches a switch made while the tab was in the background', async ({ page }) => {
  await setUp(page)
  await page.evaluate((next) => {
    // No accountsChanged reached the page; only eth_accounts tells.
    const eth = (window as unknown as { ethereum: { request: unknown } }).ethereum
    eth.request = ({ method }: { method: string }) =>
      method === 'eth_accounts' ? Promise.resolve([next]) : Promise.reject(new Error(method))
    window.dispatchEvent(new Event('focus'))
  }, OTHER)
  await expect(page.getByRole('alertdialog')).toContainText('You switched to 0x7099…79C8')
})
