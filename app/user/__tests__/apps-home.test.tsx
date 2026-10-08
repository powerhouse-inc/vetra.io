import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import type { App } from '@/modules/apps/types'

let apps: Pick<App, 'id' | 'name'>[] = []
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

import { AppsHome } from '../apps-home'

describe('AppsHome', () => {
  beforeEach(() => cleanup())

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
})
