import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import React from 'react'

let state = 'resolving'
let synced = false
let pathname = '/'
let search = ''
const replace = vi.fn()
const closeLogin = vi.fn()
const openLoginWithMessage = vi.fn()

vi.mock('@powerhousedao/reactor-browser/renown', () => ({
  useRenownAuthAsync: () => ({ state }),
  useRenownSessionSynced: () => synced,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ replace }),
}))
vi.mock('@/modules/shared/components/renown/login-modal-context', () => ({
  useLoginModal: () => ({ open: false, closeLogin, openLoginWithMessage }),
}))

import { AuthRedirect, LOGIN_TO_CONTINUE } from '../auth-redirect'

const locationReplace = vi.fn()
const fetchMock = vi.fn(() => Promise.resolve(new Response('{"ok":true}')))

describe('AuthRedirect', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    state = 'resolving'
    synced = false
    pathname = '/'
    search = ''
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, replace: locationReplace },
    })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('opens the login dialog with a message when bounced here by the proxy', () => {
    state = 'unauthenticated'
    search = 'login=1&next=%2Fuser%2Fenvironments'
    render(<AuthRedirect />)
    expect(openLoginWithMessage).toHaveBeenCalledWith(LOGIN_TO_CONTINUE)
    // The flag is consumed; `next` stays for the post-login navigation.
    expect(replace).toHaveBeenCalledWith('/?next=%2Fuser%2Fenvironments', { scroll: false })
  })

  it('does nothing while Renown is still resolving', () => {
    search = 'login=1&next=%2Fuser'
    render(<AuthRedirect />)
    expect(openLoginWithMessage).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('does not open the dialog without the login flag', () => {
    state = 'unauthenticated'
    render(<AuthRedirect />)
    expect(openLoginWithMessage).not.toHaveBeenCalled()
  })

  it('returns to a safe next path after login', () => {
    state = 'authenticated'
    synced = true
    search = 'next=%2Fuser%2Fenvironments%3Fx%3D1'
    render(<AuthRedirect />)
    expect(locationReplace).toHaveBeenCalledWith('/user/environments?x=1')
  })

  it('waits for the session cookie before navigating', () => {
    state = 'authenticated'
    search = 'next=%2Fuser'
    render(<AuthRedirect />)
    expect(locationReplace).not.toHaveBeenCalled()
  })

  it.each(['https%3A%2F%2Fevil.com', '%2F%2Fevil.com', '%2F%5Cevil.com', '%2Fcloud'])(
    'ignores an unsafe or non-gated next (%s) and falls back to the dashboard',
    (next) => {
      state = 'authenticated'
      synced = true
      search = `next=${next}`
      render(<AuthRedirect />)
      expect(locationReplace).toHaveBeenCalledWith('/user')
    },
  )

  it('clears a stale session cookie before leaving a gated page', async () => {
    // The proxy let /user through on the cookie, but the browser has no Renown login.
    state = 'unauthenticated'
    pathname = '/user/environments'
    render(<AuthRedirect />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(fetchMock).toHaveBeenCalledWith('/api/renown/session', { method: 'DELETE' })
    // The cookie is gone before navigating, so `/` can't redirect back to /user.
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(replace.mock.invocationCallOrder[0])
  })

  it('still leaves the gated page when clearing the cookie fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    state = 'unauthenticated'
    pathname = '/user'
    render(<AuthRedirect />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
  })

  it('does not reopen the dialog right after a logout', async () => {
    state = 'authenticated'
    pathname = '/user'
    const view = render(<AuthRedirect />)
    // Logout on the gated page: leave it.
    state = 'unauthenticated'
    view.rerender(<AuthRedirect />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    // The post-logout refetch lands on the proxy's ?login=1 redirect.
    pathname = '/'
    search = 'login=1&next=%2Fuser'
    view.rerender(<AuthRedirect />)
    expect(openLoginWithMessage).not.toHaveBeenCalled()
    expect(replace).toHaveBeenLastCalledWith('/?next=%2Fuser', { scroll: false })
  })
})
