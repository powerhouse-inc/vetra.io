import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { PublisherApiError } from '@/modules/publisher/graphql'
import type { InviteCodeCheck, Subscription } from '../types'

let check: { data?: InviteCodeCheck; isPending: boolean; error: Error | null; refetch?: () => void }
let mySubs: Record<string, unknown> = {}
const refetchSubs = vi.fn()
let authState = 'unauthenticated'
let subs: Subscription[] = []
const redeem = vi.fn()
const push = vi.fn()
const openLogin = vi.fn()

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@powerhousedao/reactor-browser', () => ({
  useRenownAuthAsync: () => ({ state: authState }),
}))
vi.mock('@/modules/shared/components/renown/login-modal-context', () => ({
  useOpenLogin: () => openLogin,
}))
vi.mock('../hooks/use-subscriptions', () => ({
  useInviteCodeCheck: () => check,
  useMySubscriptions: () => ({
    data: subs,
    isPending: false,
    fetchStatus: 'idle',
    error: null,
    refetch: refetchSubs,
    ...mySubs,
  }),
  useRedeemInviteCode: () => ({ mutateAsync: redeem, isPending: false }),
}))

import { RedeemFlow } from '../components/redeem/redeem-flow'

const valid = (over: Partial<InviteCodeCheck> = {}): InviteCodeCheck => ({
  valid: true,
  appId: 'kv',
  appName: 'Knowledge Vault',
  kind: 'kv-pilot',
  termLabel: 'Pilot',
  mode: 'DEDICATED',
  ...over,
})
const sub = (over: Partial<Subscription>): Subscription => ({
  licenseId: 'l1',
  appId: 'kv',
  appName: 'Knowledge Vault',
  kind: 'kv-free',
  termLabel: 'Free',
  issuer: 'INVITE_CODE',
  status: 'ACTIVE',
  start: '2026-10-01T00:00:00Z',
  end: null,
  mode: 'DEDICATED',
  environmentId: 'env-1',
  environmentLabel: 'Acme',
  openUrl: null,
  stoppedAt: null,
  deleteAfter: null,
  warnings: [],
  ...over,
})

describe('RedeemFlow', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    subs = []
    mySubs = {}
    authState = 'unauthenticated'
  })

  it('says an invalid code is invalid before asking anyone to log in', () => {
    check = {
      data: { valid: false, appId: null, appName: null, kind: null, termLabel: null, mode: null },
      isPending: false,
      error: null,
    }
    render(<RedeemFlow code="NOPE" />)
    expect(screen.getByText('This code can’t be used')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Log in with Renown' })).toBeNull()
    expect(screen.getByRole('link', { name: /try another code/i }).getAttribute('href')).toBe(
      '/redeem',
    )
  })

  it('shows what the code gives, then asks to log in', () => {
    check = { data: valid(), isPending: false, error: null }
    render(<RedeemFlow code="KV-PILOT" />)
    expect(screen.getByRole('heading', { name: 'Knowledge Vault' })).toBeTruthy()
    expect(screen.getByText('Pilot')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Log in with Renown' }))
    expect(openLogin).toHaveBeenCalled()
  })

  it('claims no step while login state is still resolving', () => {
    authState = 'resolving'
    check = { data: valid(), isPending: false, error: null }
    render(<RedeemFlow code="KV-PILOT" />)
    expect(screen.getByRole('heading', { name: 'Knowledge Vault' })).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Checking your login' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Progress' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Log in with Renown' })).toBeNull()
    expect(screen.queryByRole('button', { name: /get access/i })).toBeNull()
  })

  it('asks a project name for a dedicated plan and lands on the new subscription', async () => {
    authState = 'authenticated'
    check = { data: valid(), isPending: false, error: null }
    redeem.mockResolvedValue(sub({ licenseId: 'new-1', termLabel: 'Pilot' }))
    render(<RedeemFlow code="KV-PILOT" />)
    const button = screen.getByRole('button', { name: 'Get access' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Acme research' } })
    await act(async () => fireEvent.click(button))
    expect(redeem).toHaveBeenCalledWith({ code: 'KV-PILOT', label: 'Acme research' })
    expect(push).toHaveBeenCalledWith('/user/subscriptions?highlight=new-1')
  })

  it('needs no name for a shared plan', async () => {
    authState = 'authenticated'
    check = { data: valid({ mode: 'SHARED' }), isPending: false, error: null }
    redeem.mockResolvedValue(sub({ licenseId: 'new-2' }))
    render(<RedeemFlow code="FREE" />)
    expect(screen.queryByLabelText('Project name')).toBeNull()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect(redeem).toHaveBeenCalledWith({ code: 'FREE' })
  })

  it('never preselects switching a live licence to another plan', async () => {
    authState = 'authenticated'
    check = { data: valid(), isPending: false, error: null }
    subs = [
      sub({ licenseId: 'live' }),
      sub({ licenseId: 'setting-up', status: 'ISSUED', termLabel: 'Pending' }),
      sub({ licenseId: 'ended', status: 'EXPIRED', termLabel: 'Old', environmentLabel: 'Lab' }),
      sub({ licenseId: 'gone', status: 'REPLACED', termLabel: 'Older' }),
    ]
    redeem.mockResolvedValue(sub({ licenseId: 'new-3' }))
    render(<RedeemFlow code="KV-PILOT" />)
    const radios = screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))
    expect(radios).toEqual(['Switch Free to Pilot', 'Bring back Lab', 'Start something new'])
    for (const r of screen.getAllByRole('radio'))
      expect(r.getAttribute('aria-checked')).toBe('false')
    const button = screen.getByRole('button', { name: 'Get access' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Switch Free to Pilot' }))
    expect(screen.queryByLabelText('Project name')).toBeNull()
    await act(async () => fireEvent.click(button))
    expect(redeem).toHaveBeenCalledWith({ code: 'KV-PILOT', upgrades: 'live' })
  })

  it('preselects renewing the plan already held', async () => {
    authState = 'authenticated'
    check = { data: valid(), isPending: false, error: null }
    subs = [sub({ licenseId: 'same', kind: 'kv-pilot', termLabel: 'Pilot' })]
    redeem.mockResolvedValue(sub({ licenseId: 'renewed' }))
    render(<RedeemFlow code="KV-PILOT" />)
    expect(screen.getByRole('radio', { name: 'Renew Pilot' }).getAttribute('aria-checked')).toBe(
      'true',
    )
    // A DEDICATED code still offers a second environment.
    expect(screen.getByRole('radio', { name: 'Start something new' })).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect(redeem).toHaveBeenCalledWith({ code: 'KV-PILOT', upgrades: 'same' })
  })

  it('brings back an ended licence by default when nothing is live', async () => {
    authState = 'authenticated'
    check = { data: valid(), isPending: false, error: null }
    subs = [sub({ licenseId: 'cancelled', status: 'REVOKED' })]
    redeem.mockResolvedValue(sub({ licenseId: 'back' }))
    render(<RedeemFlow code="KV-PILOT" />)
    expect(
      screen.getByRole('radio', { name: 'Bring back Acme' }).getAttribute('aria-checked'),
    ).toBe('true')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect(redeem).toHaveBeenCalledWith({ code: 'KV-PILOT', upgrades: 'cancelled' })
  })

  it('can still start something new next to a live licence', async () => {
    authState = 'authenticated'
    check = { data: valid(), isPending: false, error: null }
    subs = [sub({ licenseId: 'live' })]
    redeem.mockResolvedValue(sub({ licenseId: 'new-4' }))
    render(<RedeemFlow code="KV-PILOT" />)
    fireEvent.click(screen.getByRole('radio', { name: 'Start something new' }))
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Second project' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect(redeem).toHaveBeenCalledWith({ code: 'KV-PILOT', label: 'Second project' })
  })

  it('renews the studio licence a person already holds', async () => {
    authState = 'authenticated'
    check = {
      data: valid({
        appId: 'studio',
        appName: 'Vetra Studio',
        mode: 'SHARED',
        termLabel: 'Early access',
      }),
      isPending: false,
      error: null,
    }
    subs = [
      sub({
        licenseId: 'studio-lic',
        appId: 'studio',
        appName: 'Vetra Studio',
        kind: 'kv-pilot',
        termLabel: 'Early access',
        mode: 'SHARED',
      }),
    ]
    redeem.mockResolvedValue(sub({ licenseId: 'studio-lic-2' }))
    render(<RedeemFlow code="STUDIO-2" />)
    // SHARED: a second account next to a live one adds nothing, so no "new" choice.
    expect(screen.queryByRole('radio', { name: 'Start something new' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Renew Early access' })).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect(redeem).toHaveBeenCalledWith({ code: 'STUDIO-2', upgrades: 'studio-lic' })
  })

  it('explains ALREADY_HOLDS and links to subscriptions', async () => {
    authState = 'authenticated'
    check = { data: valid({ mode: 'SHARED' }), isPending: false, error: null }
    redeem.mockRejectedValue(new PublisherApiError('ALREADY_HOLDS', 'already holds kv-pilot', 200))
    render(<RedeemFlow code="FREE" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect(screen.getByText('You already have this plan')).toBeTruthy()
    expect(screen.getByText('Nothing to renew.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /instead/i })).toBeNull()
    expect(screen.getByRole('link', { name: /see your subscriptions/i }).getAttribute('href')).toBe(
      '/user/subscriptions',
    )
    expect(push).not.toHaveBeenCalled()
  })

  it('never calls a code invalid because the lookup failed: it offers a retry', () => {
    const refetch = vi.fn()
    check = { isPending: false, error: new Error('network down'), refetch }
    render(<RedeemFlow code="KV-PILOT" />)
    expect(screen.queryByText('This code can’t be used')).toBeNull()
    expect(screen.getByText('We couldn’t check this code')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('does not guess what you hold when the subscriptions lookup fails', () => {
    authState = 'authenticated'
    check = { data: valid(), isPending: false, error: null }
    mySubs = { error: new Error('boom') }
    render(<RedeemFlow code="KV-PILOT" />)
    expect(screen.queryByRole('button', { name: 'Get access' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetchSubs).toHaveBeenCalled()
  })

  it('waits for the subscriptions before offering choices', () => {
    authState = 'authenticated'
    check = { data: valid(), isPending: false, error: null }
    mySubs = { isPending: true }
    render(<RedeemFlow code="KV-PILOT" />)
    expect(screen.queryByRole('button', { name: 'Get access' })).toBeNull()
    expect(screen.getByRole('status', { name: 'Checking what you already have' })).toBeTruthy()
  })

  it('shows one generic message when the code stops working at redeem time', async () => {
    authState = 'authenticated'
    check = { data: valid({ mode: 'SHARED' }), isPending: false, error: null }
    redeem.mockRejectedValue(new PublisherApiError('INVALID_CODE', 'code is paused', 200))
    render(<RedeemFlow code="FREE" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect(screen.getByText('This code can’t be used any more')).toBeTruthy()
    expect(screen.queryByText(/code is paused/)).toBeNull()
  })

  it('keeps Get access disabled after a successful redeem until the page moves on', async () => {
    authState = 'authenticated'
    check = { data: valid({ mode: 'SHARED' }), isPending: false, error: null }
    redeem.mockResolvedValue(sub({ licenseId: 'new-6' }))
    render(<RedeemFlow code="FREE" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect((screen.getByRole('button', { name: 'Get access' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect(redeem).toHaveBeenCalledTimes(1)
  })

  it('clears a failed-redeem error when the choice changes', async () => {
    authState = 'authenticated'
    check = { data: valid(), isPending: false, error: null }
    subs = [sub({ licenseId: 'live' })]
    redeem.mockRejectedValue(new PublisherApiError('INVALID_CODE', 'paused', 200))
    render(<RedeemFlow code="KV-PILOT" />)
    fireEvent.click(screen.getByRole('radio', { name: 'Switch Free to Pilot' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect(screen.getByText('This code can’t be used any more')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Start something new' }))
    expect(screen.queryByText('This code can’t be used any more')).toBeNull()
  })

  it('clears a failed-redeem error when the name is edited', async () => {
    authState = 'authenticated'
    check = { data: valid(), isPending: false, error: null }
    redeem.mockRejectedValue(new PublisherApiError('INVALID_CODE', 'paused', 200))
    render(<RedeemFlow code="KV-PILOT" />)
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'A' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get access' })))
    expect(screen.getByText('This code can’t be used any more')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'AB' } })
    expect(screen.queryByText('This code can’t be used any more')).toBeNull()
  })
})
