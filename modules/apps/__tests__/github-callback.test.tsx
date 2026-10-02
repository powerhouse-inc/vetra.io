import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GITHUB_STATE_KEY } from '@/modules/apps/lib/github-state'

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
vi.mock('@/modules/apps/hooks/use-apps', () => ({
  useConnectGithubDeploy: () => ({ mutate }),
}))

import { GithubCallback } from '@/modules/apps/components/github-callback'

beforeEach(() => {
  sessionStorage.clear()
  replace.mockReset()
  mutate.mockReset()
  openLogin.mockReset()
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

  it('refuses a code whose state was not started in this browser', () => {
    sessionStorage.setItem(GITHUB_STATE_KEY, 'mine')
    search = new URLSearchParams('code=attacker&state=theirs')
    const { getByText, getByRole } = render(<GithubCallback />)
    expect(mutate).not.toHaveBeenCalled()
    getByText(/wasn.t started from this browser/i)
    expect(getByRole('link', { name: /start again/i }).getAttribute('href')).toBe('/user/apps/new')
  })

  it('refuses a code without any state', () => {
    search = new URLSearchParams('code=attacker')
    const { getByText } = render(<GithubCallback />)
    expect(mutate).not.toHaveBeenCalled()
    getByText(/wasn.t started from this browser/i)
  })

  it('returns to the flow when GitHub sent no code (install without OAuth)', () => {
    search = new URLSearchParams('installation_id=9&setup_action=install')
    render(<GithubCallback />)
    expect(mutate).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/user/apps/new')
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
