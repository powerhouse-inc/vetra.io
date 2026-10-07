import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'

let appsState: { data?: unknown; isPending?: boolean; error?: Error | null; isSuccess?: boolean } = {}
let refetch = vi.fn()
let searchParams = new URLSearchParams()
vi.mock('../hooks/use-publisher', () => ({
  useMyApps: () => ({ refetch: (...a: unknown[]) => refetch(...a), ...appsState }),
  usePublisherLicenseTypes: () => ({ data: [], isPending: false }),
  usePublisherLicenses: () => ({ data: [], isPending: false }),
  usePublisherEnvironments: () => ({ data: [], isPending: false }),
  usePublisherToken: () => async () => 'tok',
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/user/publisher',
  useSearchParams: () => searchParams,
}))

vi.mock('@/shared/components/ui/select', () => ({
  // Native stand-in: Radix Select is not drivable in jsdom. Keeps value/onValueChange wiring real.
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select role="combobox" value={value ?? ''} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))
vi.mock('../components/tiers-tab', () => ({ TiersTab: ({ appId }: { appId: string }) => <div data-testid="tiers-app">{appId}</div> }))
vi.mock('../components/holders-tab', () => ({ HoldersTab: ({ appId }: { appId: string }) => <div data-testid="holders-app">{appId}</div> }))
vi.mock('../components/environments-tab', () => ({ EnvironmentsTab: ({ appId }: { appId: string }) => <div data-testid="env-app">{appId}</div> }))

import PublisherDashboard from '../components/publisher-dashboard'
import { PRIVATE_NAV_ITEMS, NAVBAR_CONFIGS } from '@/modules/shared/components/navbar/navbar-config'

beforeEach(() => {
  cleanup()
  appsState = {}
  refetch = vi.fn()
  searchParams = new URLSearchParams()
})

describe('PublisherDashboard', () => {
  it('shows an empty state, not a spinner, when the wallet owns no apps', async () => {
    // Review Focus 1. Indexing apps[0] here would throw and blank the page.
    appsState = { data: [], isPending: false, isSuccess: true, error: null }
    render(<PublisherDashboard />)
    expect(await screen.findByText(/no apps/i)).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('shows a loading state, not the empty state, while apps are pending', () => {
    appsState = { data: undefined, isPending: true }
    render(<PublisherDashboard />)
    expect(screen.getByText(/loading your apps/i)).toBeTruthy()
    expect(screen.queryByText(/no apps/i)).toBeNull()
  })

  it('renders the tabs when the wallet owns one app and shows no picker', async () => {
    appsState = { data: [{ id: 'a1', name: 'Knowledge Vault', status: 'ACTIVE' }], isPending: false, isSuccess: true }
    render(<PublisherDashboard />)
    expect(await screen.findByRole('tablist')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('shows an app picker when the wallet owns more than one', async () => {
    appsState = {
      data: [
        { id: 'a1', name: 'Knowledge Vault', status: 'ACTIVE' },
        { id: 'a2', name: 'Other', status: 'ACTIVE' },
      ],
      isPending: false,
      isSuccess: true,
    }
    render(<PublisherDashboard />)
    expect(await screen.findByRole('combobox')).toBeTruthy()
  })

  it('selects the tab named by ?tab= and falls back to tiers for an unknown value', () => {
    appsState = { data: [{ id: 'a1', name: 'KV', status: 'ACTIVE' }], isPending: false, isSuccess: true }
    searchParams = new URLSearchParams('tab=holders')
    render(<PublisherDashboard />)
    expect(screen.getByRole('tab', { name: 'Holders' }).getAttribute('data-state')).toBe('active')
    cleanup()
    searchParams = new URLSearchParams('tab=bogus')
    render(<PublisherDashboard />)
    expect(screen.getByRole('tab', { name: 'Tiers' }).getAttribute('data-state')).toBe('active')
  })

  it.each(['sign in to manage licences', 'the registry is unreachable'])(
    'surfaces the server error text verbatim (%s), with neither tabs nor empty state',
    async (message) => {
      // Two distinct messages: a literal in the component can match only one.
      appsState = { data: undefined, isPending: false, error: new Error(message) }
      render(<PublisherDashboard />)
      expect(await screen.findByText(message)).toBeTruthy()
      expect(screen.queryByRole('tablist')).toBeNull()
      expect(screen.queryByText(/no apps/i)).toBeNull()
    },
  )

  it('offers a retry that refetches the apps', () => {
    appsState = { data: undefined, isPending: false, error: new Error('boom') }
    render(<PublisherDashboard />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  describe('app picker effect', () => {
    const two = [
      { id: 'a1', name: 'Knowledge Vault', status: 'ACTIVE' },
      { id: 'a2', name: 'Other', status: 'ACTIVE' },
    ]
    const ready = (data: unknown) => { appsState = { data, isPending: false, isSuccess: true } }

    it('defaults to the first app: tabs get a1 and the picker shows a1', () => {
      ready(two)
      render(<PublisherDashboard />)
      expect(screen.getByTestId('tiers-app').textContent).toBe('a1')
      expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('a1')
    })

    it('choosing an app changes the appId every tab receives and the picker value follows', () => {
      ready(two)
      searchParams = new URLSearchParams('tab=holders')
      const { rerender } = render(<PublisherDashboard />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a2' } })
      expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('a2')
      expect(screen.getByTestId('holders-app').textContent).toBe('a2')
      for (const tab of ['tiers', 'environments']) {
        searchParams = new URLSearchParams(tab === 'tiers' ? '' : `tab=${tab}`)
        rerender(<PublisherDashboard />)
        expect(screen.getByTestId(tab === 'tiers' ? 'tiers-app' : 'env-app').textContent).toBe('a2')
      }
    })

    it('falls back to the first app when the selected app leaves the list', () => {
      ready(two)
      const { rerender } = render(<PublisherDashboard />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a2' } })
      expect(screen.getByTestId('tiers-app').textContent).toBe('a2')
      ready([two[0], { id: 'a3', name: 'Third', status: 'ACTIVE' }])
      rerender(<PublisherDashboard />)
      expect(screen.getByTestId('tiers-app').textContent).toBe('a1')
    })

    it('heals when the list shrinks to one app (picker gone, tabs must not keep the dead id)', () => {
      ready(two)
      const { rerender } = render(<PublisherDashboard />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a2' } })
      ready([two[0]])
      rerender(<PublisherDashboard />)
      expect(screen.queryByRole('combobox')).toBeNull()
      expect(screen.getByTestId('tiers-app').textContent).toBe('a1')
    })
  })
})

describe('navigation', () => {
  it('registers Licensing at /user/publisher in every nav list', () => {
    const lists = [PRIVATE_NAV_ITEMS, NAVBAR_CONFIGS['/vetra'].navItems]
    for (const list of lists) {
      const item = list.find((i) => i.label === 'Licensing')
      expect(item?.href).toBe('/user/publisher')
      expect(item && 'isActive' in item ? item.isActive('/user/publisher') : false).toBe(true)
    }
  })
})
