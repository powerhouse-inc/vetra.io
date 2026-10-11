import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const OLD = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const NEW = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const logout = vi.fn(() => Promise.resolve())
const login = vi.fn()
let auth: { state: string; address: string | undefined }
vi.mock('@powerhousedao/reactor-browser', () => ({
  useRenownAuthAsync: () => ({ ...auth, logout, login }),
}))

import { setPendingLoginMethod } from '@/modules/shared/lib/wallet-switch'
import { WalletSwitchGuard } from '../wallet-switch-guard'

type Listener = (accounts: string[]) => void

/** Minimal EIP-1193 injected provider. */
function fakeEthereum(initial: string[]) {
  let accounts = initial
  const listeners = new Set<Listener>()
  return {
    request: vi.fn(({ method }: { method: string }) =>
      method === 'eth_accounts' ? Promise.resolve(accounts) : Promise.reject(new Error(method)),
    ),
    on: vi.fn((event: string, fn: Listener) => event === 'accountsChanged' && listeners.add(fn)),
    removeListener: vi.fn((_: string, fn: Listener) => listeners.delete(fn)),
    /** The user picks another account in the extension. */
    switchTo(next: string[]) {
      accounts = next
      listeners.forEach((fn) => fn(next))
    },
    /** Switched while the tab was in the background: no event reached the page. */
    setSilently(next: string[]) {
      accounts = next
    },
    listenerCount: () => listeners.size,
  }
}

function install(eth: ReturnType<typeof fakeEthereum> | undefined) {
  ;(window as unknown as { ethereum?: unknown }).ethereum = eth
}

describe('WalletSwitchGuard', () => {
  beforeEach(() => {
    auth = { state: 'authenticated', address: OLD }
    localStorage.setItem('vetra:renown-login-method', 'wallet')
    logout.mockClear()
    login.mockClear()
  })
  afterEach(() => {
    cleanup()
    install(undefined)
    localStorage.clear()
  })

  it('renders nothing while the wallet matches the session', async () => {
    const eth = fakeEthereum([OLD.toLowerCase()])
    install(eth)
    render(<WalletSwitchGuard />)
    await waitFor(() => expect(eth.request).toHaveBeenCalled())
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks when the wallet switches accounts, and "Stay" dismisses until the next switch', async () => {
    const eth = fakeEthereum([OLD])
    install(eth)
    render(<WalletSwitchGuard />)
    await waitFor(() => expect(eth.listenerCount()).toBe(1))

    act(() => eth.switchTo([NEW]))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('You switched to 0x7099…79C8 in your wallet.')

    fireEvent.click(screen.getByRole('button', { name: 'Stay as 0xf39F…2266' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(logout).not.toHaveBeenCalled()

    // Same account again: still dismissed. A different one: ask again.
    act(() => eth.switchTo([NEW]))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    act(() => eth.switchTo(['0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC']))
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
  })

  it('"Sign in as" logs out, then starts a wallet sign-in', async () => {
    const eth = fakeEthereum([NEW])
    install(eth)
    render(<WalletSwitchGuard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in as 0x7099…79C8' }))
    await waitFor(() => expect(login).toHaveBeenCalledWith(undefined, 'wallet'))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(logout.mock.invocationCallOrder[0]).toBeLessThan(login.mock.invocationCallOrder[0])
  })

  it('catches a switch made while the tab was in the background, on focus', async () => {
    const eth = fakeEthereum([OLD])
    install(eth)
    render(<WalletSwitchGuard />)
    await waitFor(() => expect(eth.request).toHaveBeenCalledTimes(1))
    eth.setSilently([NEW])
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
  })

  it('stays out of the way for Privy email/Google sessions, logged-out visitors and no wallet', async () => {
    localStorage.setItem('vetra:renown-login-method', 'google')
    const eth = fakeEthereum([NEW])
    install(eth)
    const { unmount } = render(<WalletSwitchGuard />)
    await act(() => Promise.resolve())
    expect(screen.queryByRole('alertdialog')).toBeNull()
    unmount()

    localStorage.setItem('vetra:renown-login-method', 'wallet')
    auth = { state: 'unauthenticated', address: undefined }
    render(<WalletSwitchGuard />)
    await act(() => Promise.resolve())
    expect(screen.queryByRole('alertdialog')).toBeNull()
    cleanup()

    install(undefined)
    auth = { state: 'authenticated', address: OLD }
    render(<WalletSwitchGuard />)
    await act(() => Promise.resolve())
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('forgets "stay" when the session ends', async () => {
    const eth = fakeEthereum([OLD])
    install(eth)
    const { rerender } = render(<WalletSwitchGuard />)
    await waitFor(() => expect(eth.listenerCount()).toBe(1))
    act(() => eth.switchTo([NEW]))
    fireEvent.click(await screen.findByRole('button', { name: 'Stay as 0xf39F…2266' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    auth = { state: 'unauthenticated', address: undefined }
    rerender(<WalletSwitchGuard />)
    localStorage.setItem('vetra:renown-login-method', 'wallet')
    auth = { state: 'authenticated', address: OLD }
    rerender(<WalletSwitchGuard />)
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
  })

  it('keeps the dialog usable when signing out fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logout.mockImplementationOnce(() => Promise.reject(new Error('network down')))
    const eth = fakeEthereum([NEW])
    install(eth)
    render(<WalletSwitchGuard />)
    const signIn = await screen.findByRole('button', { name: 'Sign in as 0x7099…79C8' })
    fireEvent.click(signIn)
    await waitFor(() => expect(warn).toHaveBeenCalled())
    expect(login).not.toHaveBeenCalled()
    await waitFor(() => expect((signIn as HTMLButtonElement).disabled).toBe(false))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    warn.mockRestore()
  })

  it('stores the login method on a successful sign-in and clears it on sign-out', async () => {
    localStorage.clear()
    auth = { state: 'unauthenticated', address: undefined }
    const { rerender } = render(<WalletSwitchGuard />)
    setPendingLoginMethod('email')
    expect(localStorage.getItem('vetra:renown-login-method')).toBeNull()
    auth = { state: 'authenticated', address: OLD }
    rerender(<WalletSwitchGuard />)
    await waitFor(() => expect(localStorage.getItem('vetra:renown-login-method')).toBe('email'))
    auth = { state: 'unauthenticated', address: undefined }
    rerender(<WalletSwitchGuard />)
    await waitFor(() => expect(localStorage.getItem('vetra:renown-login-method')).toBeNull())
  })

  it('unsubscribes on unmount', async () => {
    const eth = fakeEthereum([OLD])
    install(eth)
    const { unmount } = render(<WalletSwitchGuard />)
    await waitFor(() => expect(eth.listenerCount()).toBe(1))
    unmount()
    expect(eth.listenerCount()).toBe(0)
  })
})
