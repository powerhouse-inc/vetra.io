/**
 * CSRF protection for the Vetra Deploy GitHub install/authorize round-trip.
 *
 * Before leaving for GitHub we store a random nonce in sessionStorage and pass
 * it as `state`; GitHub hands it back to /user/apps/github/callback. The
 * callback only exchanges the `code` when `state` matches, so a link carrying
 * someone else's code can't attach their GitHub account to the victim.
 */
export const GITHUB_STATE_KEY = 'vetra-apps:github-oauth-state'

type StateStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Create and remember a fresh nonce (replaces any previous one). */
export function createGithubState(storage: StateStorage): string {
  const nonce = randomHex()
  storage.setItem(GITHUB_STATE_KEY, nonce)
  return nonce
}

/** `url` with `state=<nonce>` (replacing any existing state param). */
export function withGithubState(url: string, nonce: string): string {
  const parsed = new URL(url)
  parsed.searchParams.set('state', nonce)
  return parsed.toString()
}

/** Length-independent-ish comparison; nonces are not secret-length sensitive. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * True when `state` matches the stored nonce. The nonce is deleted either way,
 * so each round-trip can be used once.
 */
export function consumeGithubState(storage: StateStorage, state: string | null): boolean {
  const expected = storage.getItem(GITHUB_STATE_KEY)
  storage.removeItem(GITHUB_STATE_KEY)
  if (!expected || !state) return false
  return sameString(expected, state)
}

/** Navigate to a GitHub install/authorize URL with a fresh `state`. Browser only. */
export function startGithubFlow(url: string): void {
  let target = url
  try {
    target = withGithubState(url, createGithubState(window.sessionStorage))
  } catch {
    /* storage blocked: the callback will refuse the code and ask to start again */
  }
  window.location.assign(target)
}
