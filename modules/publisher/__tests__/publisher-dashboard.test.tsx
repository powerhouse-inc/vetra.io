import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

let appsState: { data?: unknown; isPending?: boolean; error?: Error | null; isSuccess?: boolean } = {}
let searchParams = new URLSearchParams()
vi.mock('../hooks/use-publisher', () => ({
  useMyApps: () => appsState,
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

import PublisherDashboard from '../components/publisher-dashboard'
import { PRIVATE_NAV_ITEMS, NAVBAR_CONFIGS } from '@/modules/shared/components/navbar/navbar-config'

beforeEach(() => {
  cleanup()
  appsState = {}
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

  it('surfaces the server error text verbatim and renders neither tabs nor empty state', async () => {
    appsState = { data: undefined, isPending: false, error: new Error('sign in to manage licences') }
    render(<PublisherDashboard />)
    expect(await screen.findByText('sign in to manage licences')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByText(/no apps/i)).toBeNull()
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
