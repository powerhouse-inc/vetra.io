import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HolderInstance } from '../types'

let state: { data: HolderInstance[] | undefined; isPending: boolean; error: Error | null }
const updateNow = vi.fn()

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-apps', () => ({
  useMyInstances: () => ({ ...state, refetch: vi.fn(), isRefetching: false }),
  useUpdateInstanceNow: () => ({ mutate: updateNow, isPending: false, error: null }),
}))
vi.mock('../hooks/use-app-names', () => ({
  useAppIdentityOf: () => () => ({ appDid: null, name: null, logo: null }),
}))
vi.mock('../components/holder-instance-panel', () => ({
  HolderInstancePanel: () => <div>holder-panel</div>,
}))

import { MyInstances } from '../components/my-instances'

function instance(over: Partial<HolderInstance> = {}): HolderInstance {
  return {
    instanceId: 'i1',
    appId: 'kv',
    appName: 'Knowledge Vault',
    planName: 'Pro',
    access: 'own',
    url: 'https://kv-pro-1a2b.vetra.io',
    status: 'ready',
    reason: null,
    runningVersion: '1.2.0',
    ...over,
  }
}

const update = {
  rolloutId: 'r1',
  version: '1.3.0',
  dueAt: '2026-11-15T10:00:00Z',
  notes: 'A **faster** editor',
  paused: false,
  canUpdateNow: true,
}

describe('MyInstances holder features', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    state = { data: [instance()], isPending: false, error: null }
  })

  it('announces a coming update with its notes and starts it now', () => {
    state.data = [instance({ update })]
    render(<MyInstances />)
    const banner = screen.getByTestId('update-i1')
    expect(banner.textContent).toContain('Version 1.3.0 on')
    expect(banner.textContent).toContain('faster')
    fireEvent.click(within(banner).getByRole('button', { name: 'Update now' }))
    expect(updateNow).toHaveBeenCalledWith('i1', expect.anything())
  })

  it('says a paused update is paused and offers no Update now when the plan forbids it', () => {
    state.data = [instance({ update: { ...update, paused: true, canUpdateNow: false } })]
    render(<MyInstances />)
    const banner = screen.getByTestId('update-i1')
    expect(banner.textContent).toContain('paused by the publisher')
    expect(within(banner).queryByRole('button')).toBeNull()
  })

  it('shows end-of-licence notices, most urgent first', () => {
    state.data = [
      instance({
        notices: [
          { kind: 'EXPIRING', at: '2026-12-01T00:00:00Z', message: 'Your licence ends soon.' },
          { kind: 'DELETE_IMMINENT', at: null, message: 'Your data is deleted tomorrow.' },
        ],
      }),
    ]
    render(<MyInstances />)
    const items = screen.getAllByRole('status')
    expect(items[0].textContent).toContain('deleted tomorrow')
    expect(items[1].textContent).toContain('licence ends soon')
  })

  it('offers Manage on own instances only', () => {
    state.data = [instance(), instance({ instanceId: 'i2', access: 'shared' })]
    render(<MyInstances />)
    const own = screen.getByTestId('my-instance-i1')
    expect(within(own).getByRole('button', { name: 'Manage' })).toBeTruthy()
    expect(
      within(screen.getByTestId('my-instance-i2')).queryByRole('button', { name: 'Manage' }),
    ).toBeNull()
    fireEvent.click(within(own).getByRole('button', { name: 'Manage' }))
    expect(screen.getByText('holder-panel')).toBeTruthy()
  })
})
