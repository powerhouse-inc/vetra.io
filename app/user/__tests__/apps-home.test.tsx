import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import type { App } from '@/modules/apps/types'

let apps: Pick<App, 'id' | 'name'>[] = []
let activeOrg: { id: string; name: string; role: string } | null = null
let published: { id: string; name: string; status: string }[] = []

vi.mock('@/modules/apps/hooks/use-apps', () => ({
  useMyApps: () => ({
    data: apps,
    isPending: false,
    error: null,
    refetch: vi.fn(),
    isRefetching: false,
  }),
  useStandaloneEnvFilter: () => ({ isStandalone: () => true }),
}))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useActiveOrg: () => ({
    orgId: activeOrg?.id ?? null,
    org: activeOrg,
    orgs: [],
    isLoading: false,
    setActiveOrg: vi.fn(),
  }),
}))
vi.mock('@/modules/publisher/hooks/use-publisher', () => ({
  usePublisherApps: () => ({ data: published }),
}))
vi.mock('@/modules/apps/components/app-card', () => ({
  AppCard: ({ app }: { app: { name: string } }) => <div>card:{app.name}</div>,
}))
vi.mock('@/modules/apps/components/apps-empty-state', () => ({
  AppsEmptyState: () => <div>empty-state</div>,
}))
vi.mock('../environments/cloud-projects', () => ({ CloudEnvironments: () => null }))
vi.mock('@/modules/apps/components/needs-attention', () => ({ NeedsAttention: () => null }))

import { AppsHome } from '../apps-home'

describe('AppsHome', () => {
  beforeEach(() => cleanup())
  afterEach(() => {
    activeOrg = null
  })

  it('adds a card for an app published for licensing only', () => {
    apps = [{ id: 'vault', name: 'Knowledge Vault' }]
    published = [
      { id: 'vault', name: 'Knowledge Vault', status: 'ACTIVE' },
      { id: 'studio-1', name: 'Vetra Studio', status: 'ACTIVE' },
    ]
    render(<AppsHome />)
    expect(screen.getByText('card:Knowledge Vault')).toBeTruthy()
    expect(screen.queryByText('card:Vetra Studio')).toBeNull()
    expect(screen.getByRole('link', { name: 'Vetra Studio' }).getAttribute('href')).toBe(
      '/user/apps/studio-1?tab=plans',
    )
    expect(screen.getByText('Licensing only')).toBeTruthy()
  })

  it('shows licensing-only apps above the empty state when there are no git apps', () => {
    apps = []
    published = [{ id: 'studio-1', name: 'Vetra Studio', status: 'ACTIVE' }]
    render(<AppsHome />)
    expect(screen.getByRole('link', { name: 'Vetra Studio' })).toBeTruthy()
    expect(screen.getByText('empty-state')).toBeTruthy()
  })

  it('names the organisation it is showing', () => {
    activeOrg = { id: 'o1', name: 'Acme', role: 'ADMIN' }
    apps = [{ id: 'a1', name: 'Shop' }]
    render(<AppsHome />)
    expect(screen.getByText(/Apps of/)).toBeTruthy()
    expect(screen.getByText(/New app in Acme/)).toBeTruthy()
  })

  it('offers no create link to a plain member', () => {
    activeOrg = { id: 'o1', name: 'Acme', role: 'MEMBER' }
    apps = [{ id: 'a1', name: 'Shop' }]
    render(<AppsHome />)
    expect(screen.getByText(/Ask an owner or admin of Acme to create apps/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /New app in Acme/ })).toBeNull()
  })

  it('gates "New environment" like the "New app" tile', () => {
    activeOrg = { id: 'o1', name: 'Acme', role: 'MEMBER' }
    apps = []
    render(<AppsHome />)
    expect(screen.queryByRole('link', { name: 'New environment' })).toBeNull()
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'New environment' })
    expect(button.disabled).toBe(true)
    expect(button.parentElement?.getAttribute('title')).toBe(
      'Ask an owner or admin of Acme to create environments',
    )
  })

  it('links "New environment" for an admin and for a personal account', () => {
    activeOrg = { id: 'o1', name: 'Acme', role: 'ADMIN' }
    apps = []
    render(<AppsHome />)
    expect(screen.getByRole('link', { name: 'New environment' }).getAttribute('href')).toBe(
      '/user/environments/new',
    )
    cleanup()
    activeOrg = null
    render(<AppsHome />)
    expect(screen.getByRole('link', { name: 'New environment' })).toBeTruthy()
  })
})
