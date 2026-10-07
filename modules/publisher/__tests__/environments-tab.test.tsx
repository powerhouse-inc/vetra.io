import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import React from 'react'

let state: Record<string, unknown> = {}
const hookArgs: unknown[] = []
vi.mock('../hooks/use-publisher', () => ({
  usePublisherEnvironments: (appId: string) => {
    hookArgs.push(appId)
    return state
  },
}))

import { EnvironmentsTab } from '../components/environments-tab'

const env = (n: number) => ({
  appId: 'a1',
  user: `0xuser${n}`,
  environmentId: `env-${n}`,
  licenseId: `lic-${n}`,
  templateHash: `${n}`.repeat(20),
})

beforeEach(() => {
  cleanup()
  state = {}
  hookArgs.length = 0
})

describe('EnvironmentsTab', () => {
  it('renders every row with its own holder, environment, licence and truncated template', () => {
    state = { data: [env(1), env(2), env(3)], isPending: false, error: null }
    render(<EnvironmentsTab appId="a1" />)
    for (const n of [1, 2, 3]) {
      const row = screen.getByText(`env-${n}`).closest('tr') as HTMLElement
      expect(within(row).getByText(`0xuser${n}`)).toBeTruthy()
      expect(within(row).getByText(`lic-${n}`)).toBeTruthy()
      expect(within(row).getByText(`${n}`.repeat(12))).toBeTruthy()
      expect(within(row).queryByText(`${n}`.repeat(20))).toBeNull()
    }
  })

  it('reads the environments of the app it was given', () => {
    state = { data: [], isPending: false, error: null }
    render(<EnvironmentsTab appId="app-xyz" />)
    expect(hookArgs).toContain('app-xyz')
  })

  it('explains the provisioning delay instead of showing a bare empty table', () => {
    state = { data: [], isPending: false, error: null }
    render(<EnvironmentsTab appId="a1" />)
    expect(screen.getByText(/no environments yet/i)).toBeTruthy()
    expect(screen.getByText(/appear shortly after/i)).toBeTruthy()
    expect(screen.getByText(/runs on a timer/i)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('treats missing data as empty rather than crashing', () => {
    state = { data: undefined, isPending: false, error: null }
    render(<EnvironmentsTab appId="a1" />)
    expect(screen.getByText(/appear shortly after/i)).toBeTruthy()
  })

  it('shows a loading state, not the empty explanation, while pending', () => {
    state = { data: undefined, isPending: true, error: null }
    render(<EnvironmentsTab appId="a1" />)
    expect(screen.getByText(/loading environments/i)).toBeTruthy()
    expect(screen.queryByText(/appear shortly after/i)).toBeNull()
  })

  it('surfaces a read error verbatim and does not claim there are no environments', () => {
    state = { data: undefined, isPending: false, error: new Error('no such app') }
    render(<EnvironmentsTab appId="a1" />)
    expect(screen.getByText('no such app')).toBeTruthy()
    expect(screen.queryByText(/no environments yet/i)).toBeNull()
  })
})
