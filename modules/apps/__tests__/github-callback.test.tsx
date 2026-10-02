import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GITHUB_REAUTH_KEY, GITHUB_STATE_KEY } from '@/modules/apps/lib/github-state'

const replace = vi.fn()
let search = new URLSearchParams()
let authState = 'authenticated'
const mutate = vi.fn()
const openLogin = vi.fn()

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => search,
}))
vi.mock('@powerhousedao/reactor-browser', () => ({
  useRenownAuthAsync: () => ({ state: authState }),
}))
vi.mock('@/modules/shared/components/renown/login-modal-context', () => ({
  useOpenLogin: () => openLogin,
}))
const startGithubFlow = vi.fn()
let appInfo: { authorizeUrl: string } | undefined = {
  authorizeUrl: 'https://github.com/login/oauth/authorize?client_id=x',
}
vi.mock('@/modules/apps/hooks/use-apps', () => ({
  useConnectGithubDeploy: () => ({ mutate }),
  useGithubDeployAppInfo: () => ({ data: appInfo }),
}))
vi.mock('@/modules/apps/lib/github-state', async (orig) => ({
  ...(await orig<typeof import('@/modules/apps/lib/github-state')>()),
  startGithubFlow: (url: string) => {
    startGithubFlow(url)
  },
}))

import { GithubCallback } from '@/modules/apps/components/github-callback'

beforeEach(() => {
  sessionStorage.clear()
  replace.mockReset()
  mutate.mockReset()
  openLogin.mockReset()
  startGithubFlow.mockReset()
  appInfo = { authorizeUrl: 'https://github.com/login/oauth/authorize?client_id=x' }
  authState = 'authenticated'
})
afterEach(() => vi.useRealTimers())

describe('GithubCallback', () => {
  it('exchanges the code only when state matches the stored nonce', () => {
    sessionStorage.setItem(GITHUB_STATE_KEY, 'nonce-123')
    search = new URLSearchParams('code=c0de&installation_id=9&state=nonce-123')
    render(<GithubCallback />)
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0]).toBe('c0de')
    expect(sessionStorage.getItem(GITHUB_STATE_KEY)).toBeNull()
  })

  it('ignores a code with a foreign state and re-authorizes once with a fresh state', () => {
    sessionStorage.setItem(GITHUB_STATE_KEY, 'mine')
    search = new URLSearchParams('code=attacker&state=theirs')
    render(<GithubCallback />)
    expect(mutate).not.toHaveBeenCalled()
    expect(startGithubFlow).toHaveBeenCalledWith(appInfo!.authorizeUrl)
    expect(sessionStorage.getItem(GITHUB_REAUTH_KEY)).toBe('1')
  })

  it('re-authorizes when GitHub returns from an install without a code or state', () => {
    search = new URLSearchParams('installation_id=9&setup_action=install')
    render(<GithubCallback />)
    expect(mutate).not.toHaveBeenCalled()
    expect(startGithubFlow).toHaveBeenCalledWith(appInfo!.authorizeUrl)
  })

  it('re-authorizes when an install returns a code without state', () => {
    search = new URLSearchParams('code=c&installation_id=9&setup_action=install')
    render(<GithubCallback />)
    expect(mutate).not.toHaveBeenCalled()
    expect(startGithubFlow).toHaveBeenCalledTimes(1)
  })

  it('does not loop: a second foreign/missing state after re-authorizing shows the error', () => {
    sessionStorage.setItem(GITHUB_REAUTH_KEY, '1')
    search = new URLSearchParams('code=attacker&state=theirs')
    const { getByText, getByRole } = render(<GithubCallback />)
    expect(mutate).not.toHaveBeenCalled()
    expect(startGithubFlow).not.toHaveBeenCalled()
    getByText(/wasn.t started from this browser/i)
    expect(getByRole('link', { name: /start again/i }).getAttribute('href')).toBe('/user/apps/new')
  })

  it('clears the re-authorize flag after a successful exchange', () => {
    sessionStorage.setItem(GITHUB_REAUTH_KEY, '1')
    sessionStorage.setItem(GITHUB_STATE_KEY, 'n')
    search = new URLSearchParams('code=c&state=n')
    render(<GithubCallback />)
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(GITHUB_REAUTH_KEY)).toBeNull()
  })

  it('asks to sign in after 10s without a session, keeping the nonce', () => {
    vi.useFakeTimers()
    authState = 'resolving'
    sessionStorage.setItem(GITHUB_STATE_KEY, 'n')
    search = new URLSearchParams('code=c&state=n')
    const { getByRole, queryByRole } = render(<GithubCallback />)
    expect(queryByRole('button', { name: /sign in to continue/i })).toBeNull()
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    act(() => {
      getByRole('button', { name: /sign in to continue/i }).click()
    })
    expect(openLogin).toHaveBeenCalled()
    expect(mutate).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(GITHUB_STATE_KEY)).toBe('n')
  })
})
