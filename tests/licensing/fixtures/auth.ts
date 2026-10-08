import { expect, test, type Page, type Route } from '@playwright/test'
import { RENOWN_SESSION_COOKIE } from '@renown/sdk/node'
import { CLOUD_URL } from './cloud-url'

/** Renown switchboard used by the browser during sign-in (the SDK default). */
const RENOWN_SWITCHBOARD = 'https://switchboard.renown.vetra.io/graphql'

/** Every request the browser sends off localhost that no mock answered, for debugging. */
export const offline: string[] = []

type GqlBody = { query?: string; operationName?: string; variables?: Record<string, unknown> }

function gqlBody(route: Route): GqlBody {
  try {
    return (route.request().postDataJSON() as GqlBody | null) ?? {}
  } catch {
    return {}
  }
}

/**
 * Answers the two Renown calls the mock-adapter login makes, entirely in the test.
 *
 * Why not a recorded HAR (the plan's first idea): HAR replay matches POST bodies
 * strictly, and `renown_issueCredential` carries a fresh EIP-712 signature and
 * timestamps on every run, so a recording never matches. Nothing in the Renown
 * reply is checked by the app either: the session JWT is minted and signed in the
 * browser by the app's own key, and proxy.ts / the root layout verify it locally
 * (`verifyCredential: false`). So the replies can be fixed values.
 *
 * Also fences the page off the internet: any other non-localhost request (analytics
 * scripts, the builder-profile switchboard) is stubbed or aborted, so the journeys
 * are deterministic and need no network. Register this BEFORE `mockCloud` — later
 * routes win, so the cloud mock takes precedence over the catch-all below.
 */
export async function routeRenown(page: Page): Promise<void> {
  await page.route(
    (url) => url.hostname !== 'localhost' && url.href !== CLOUD_URL,
    async (route) => {
      const url = route.request().url()
      const { query = '' } = gqlBody(route)

      if (url === RENOWN_SWITCHBOARD) {
        // Stores the signed credential; the SDK only needs a document id back.
        if (query.includes('renown_issueCredential')) {
          return route.fulfill({ json: { data: { renown_issueCredential: 'e2e-credential-doc' } } })
        }
        // Profile lookup by address: an empty list means "no Renown profile yet".
        if (query.includes('renownUsers'))
          return route.fulfill({ json: { data: { renownUsers: [] } } })
        // Deliberately NOT answered: `renownCredentials` (read after login) falls through to
        // the GraphQL error below, which the SDK tolerates. An empty list means "no
        // credential bound to this key", and the SDK logs the session straight back out
        // (seen while building this harness).
      }
      // Builder profile (header avatar / teams) from the data switchboard: none.
      if (query.includes('fetchBuilderTeamsByMember')) {
        return route.fulfill({ json: { data: { fetchBuilderTeamsByMember: [] } } })
      }
      if (query.includes('fetchBuilderAccount')) {
        return route.fulfill({ json: { data: { fetchBuilderAccount: null } } })
      }

      offline.push(`${route.request().method()} ${url} ${query.replace(/\s+/g, ' ').slice(0, 80)}`)
      if (query)
        return route.fulfill({ json: { data: null, errors: [{ message: 'offline in e2e' }] } })
      return route.abort()
    },
  )
}

/**
 * Logs in with the mock adapter from a public page (everything under /user is
 * behind proxy.ts) and waits for the session cookie the proxy checks.
 */
export async function logIn(page: Page, path = '/redeem/E2E-LOGIN'): Promise<void> {
  await page.goto(path)
  await page.getByRole('main').getByRole('button', { name: 'Log in with Renown' }).click()
  // The mock adapter answers for wallet, google and email; any of them signs with the test key.
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /wallet/i })
    .first()
    .click()
  await expect
    .poll(
      async () => (await page.context().cookies()).some((c) => c.name === RENOWN_SESSION_COOKIE),
      {
        timeout: 30_000,
      },
    )
    .toBe(true)
}

/**
 * Full-page screenshot for the visual pass in Task 15, into
 * licensing-screens/<project>/<name>.png (git-ignored; Playwright wipes its outputDir each run).
 */
export async function snap(page: Page, name: string): Promise<void> {
  const info = test.info()
  await page.screenshot({
    path: `licensing-screens/${info.project.name}/${name}.png`,
    fullPage: true,
    // Freeze CSS transitions so a closing dialog or a sliding toast is not caught mid-way.
    animations: 'disabled',
  })
}
