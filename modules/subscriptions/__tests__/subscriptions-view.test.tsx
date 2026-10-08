import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import type { Subscription } from '../types'

let subs: { data?: Subscription[]; isPending: boolean; error: Error | null }
let params = new URLSearchParams()
const cancel = vi.fn()
const refetch = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/navigation', () => ({ useSearchParams: () => params }))
vi.mock('../hooks/use-subscriptions', () => ({
  useMySubscriptions: () => ({ ...subs, refetch, isRefetching: false }),
  useCancelSubscription: () => ({ mutateAsync: cancel, isPending: false }),
}))

import { SubscriptionsView } from '../components/subscriptions-view'

const sub = (over: Partial<Subscription>): Subscription => ({
  licenseId: 'l1', appId: 'kv', appName: 'Knowledge Vault', kind: 'kv-pro', termLabel: 'Pro',
  issuer: 'INVITE_CODE', status: 'ACTIVE', start: '2026-10-01T00:00:00Z', end: null, mode: 'DEDICATED',
  environmentId: 'env-1', environmentLabel: 'Acme', openUrl: null, stoppedAt: null, deleteAfter: null,
  warnings: [], ...over,
})

describe('SubscriptionsView', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    params = new URLSearchParams()
  })

  it('explains what will show up here and links to /redeem', () => {
    subs = { data: [], isPending: false, error: null }
    render(<SubscriptionsView />)
    expect(screen.getByText('No subscriptions yet')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /redeem a code/i })[0].getAttribute('href')).toBe('/redeem')
  })

  it('shows a skeleton while loading', () => {
    subs = { isPending: true, error: null }
    render(<SubscriptionsView />)
    expect(screen.getByRole('status', { name: 'Loading subscriptions' })).toBeTruthy()
    expect(screen.queryByText('No subscriptions yet')).toBeNull()
  })

  it('shows an error with retry, never the empty claim', () => {
    subs = { isPending: false, error: new Error('boom') }
    render(<SubscriptionsView />)
    expect(screen.queryByText('No subscriptions yet')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetch).toHaveBeenCalled()
  })

  it('groups by app and tucks ended ones away', () => {
    subs = {
      data: [sub({ licenseId: 'a' }), sub({ licenseId: 'b', status: 'EXPIRED' }), sub({ licenseId: 'c', appId: 'pf', appName: 'pfnuer' })],
      isPending: false,
      error: null,
    }
    render(<SubscriptionsView />)
    const kv = screen.getByRole('region', { name: 'Knowledge Vault' })
    expect(within(kv).getByTestId('subscription-a')).toBeTruthy()
    expect(within(kv).queryByTestId('subscription-b')).toBeNull()
    fireEvent.click(within(kv).getByRole('button', { name: 'Show 1 ended' }))
    expect(within(kv).getByTestId('subscription-b')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'pfnuer' })).toBeTruthy()
  })

  it('highlights the subscription named in the URL', () => {
    params = new URLSearchParams('highlight=a')
    subs = { data: [sub({ licenseId: 'a' })], isPending: false, error: null }
    render(<SubscriptionsView />)
    expect(screen.getByTestId('subscription-a').getAttribute('data-highlighted')).toBe('true')
  })

  it('cancels after confirming, with dedicated-environment copy', async () => {
    subs = { data: [sub({ licenseId: 'a' })], isPending: false, error: null }
    cancel.mockResolvedValue(true)
    render(<SubscriptionsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText(/keeps running for 14 days/i)).toBeTruthy()
    expect(cancel).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' })))
    expect(cancel).toHaveBeenCalledWith({ licenseId: 'a' })
  })

  it('keeping it sends nothing', () => {
    subs = { data: [sub({ licenseId: 'a' })], isPending: false, error: null }
    render(<SubscriptionsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(cancel).not.toHaveBeenCalled()
  })
})
