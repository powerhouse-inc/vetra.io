import { cleanup, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppsApiError } from '../graphql'
import type { HolderInstance } from '../types'

const updateNow = vi.fn()
vi.mock('../components/holder-instance-panel', () => ({
  HolderInstancePanel: () => <div>holder-panel</div>,
}))
let state: { data: HolderInstance[] | undefined; isPending: boolean; error: Error | null }

vi.mock('../hooks/use-apps', () => ({
  useMyInstances: () => ({ ...state, refetch: vi.fn(), isRefetching: false }),
  useUpdateInstanceNow: () => ({ mutate: updateNow, isPending: false, error: null }),
}))
vi.mock('../hooks/use-app-names', () => ({
  useAppIdentityOf: () => (appId: string) =>
    appId === 'kv'
      ? { appDid: 'did:key:kv', name: 'Knowledge Vault', logo: null }
      : { appDid: null, name: null, logo: null },
}))

import { MyInstances } from '../components/my-instances'

function instance(over: Partial<HolderInstance> = {}): HolderInstance {
  return {
    instanceId: 'i1',
    appId: 'kv',
    appName: 'bai-knowledge-note',
    planName: 'Pro',
    access: 'own',
    url: 'https://kv-pro-1a2b.vetra.io',
    status: 'ready',
    reason: null,
    runningVersion: '1.2.0',
    ...over,
  }
}

describe('MyInstances', () => {
  beforeEach(() => {
    cleanup()
    state = { data: [instance()], isPending: false, error: null }
  })

  it('names the app by its Renown profile and links the instance', () => {
    render(<MyInstances />)
    const card = screen.getByTestId('my-instance-i1')
    expect(within(card).getByText('Knowledge Vault')).toBeTruthy()
    expect(card.textContent).not.toContain('bai-knowledge-note')
    expect(card.textContent).toContain('Pro · Own instance')
    expect(within(card).getByText('ready')).toBeTruthy()
    expect(within(card).getByRole('link', { name: /Open/ }).getAttribute('href')).toBe(
      'https://kv-pro-1a2b.vetra.io',
    )
  })

  it('falls back to the app record name without a profile', () => {
    state.data = [instance({ appId: 'other', appName: 'Sektar', access: 'shared' })]
    render(<MyInstances />)
    expect(screen.getByText('Sektar')).toBeTruthy()
  })

  it('says why an instance is stopped', () => {
    state.data = [instance({ status: 'stopped', reason: 'licence ended', url: null })]
    render(<MyInstances />)
    const card = screen.getByTestId('my-instance-i1')
    expect(card.textContent).toContain('stopped: licence ended')
    expect(within(card).queryByRole('link')).toBeNull()
  })

  it('shows an empty state', () => {
    state.data = []
    render(<MyInstances />)
    expect(screen.getByText('No instances yet')).toBeTruthy()
  })

  it('says when this Vetra has no plans yet', () => {
    state = { data: undefined, isPending: false, error: new AppsApiError('APPS_UNAVAILABLE', 'x') }
    render(<MyInstances />)
    expect(screen.getByText('Not available yet')).toBeTruthy()
  })
})
