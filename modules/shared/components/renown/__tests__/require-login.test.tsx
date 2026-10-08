import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

let state = 'resolving'
const openLogin = vi.fn()
vi.mock('@powerhousedao/reactor-browser', () => ({ useRenownAuthAsync: () => ({ state }) }))
vi.mock('@/modules/shared/components/renown/login-modal-context', () => ({ useOpenLogin: () => openLogin }))

import { RequireLogin } from '../require-login'

describe('RequireLogin', () => {
  beforeEach(() => {
    cleanup()
  })

  it('shows a skeleton while Renown resolves', () => {
    state = 'resolving'
    render(<RequireLogin>secret</RequireLogin>)
    expect(screen.getByRole('status', { name: /checking your login/i })).toBeTruthy()
    expect(screen.queryByText('secret')).toBeNull()
  })

  it('asks a logged-out visitor to log in', () => {
    state = 'unauthenticated'
    render(<RequireLogin title="See your subscriptions">secret</RequireLogin>)
    expect(screen.getByRole('heading', { name: 'See your subscriptions' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Log in with Renown' }))
    expect(openLogin).toHaveBeenCalled()
  })

  it('renders children once logged in', () => {
    state = 'authenticated'
    render(<RequireLogin>secret</RequireLogin>)
    expect(screen.getByText('secret')).toBeTruthy()
  })
})
