import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import type { App } from '../types'

let searchParams = new URLSearchParams()
let publisher: { isPublisher: boolean; app?: { id: string; name: string; status: string }; isPending: boolean } = {
  isPublisher: true,
  app: { id: 'app-1', name: 'Vault', status: 'ACTIVE' },
  isPending: false,
}
let app: App

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/user/apps/app-1',
  useSearchParams: () => searchParams,
}))
vi.mock('@powerhousedao/reactor-browser', () => ({
  useRenownAuthAsync: () => ({ state: 'authenticated' }),
}))
vi.mock('../hooks/use-apps', () => ({
  useApp: () => ({ data: app, isPending: false, error: null }),
  useAppDeployments: () => ({ data: [], isPending: false, error: null }),
  useGithubDeployAppInfo: () => ({ data: undefined }),
  useConfirmAppIdentity: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/modules/publisher/hooks/use-publisher', () => ({
  useAppPublisher: () => publisher,
}))
vi.mock('../components/app-overview', () => ({ AppOverview: () => <div>overview-content</div> }))
vi.mock('../components/app-deployments', () => ({ AppDeployments: () => <div>deployments-content</div> }))
vi.mock('../components/app-settings', () => ({ AppSettings: () => <div>settings-content</div> }))
vi.mock('../components/github-flow-link', () => ({ GithubFlowLink: () => null }))
vi.mock('@/modules/publisher/components/templates/templates-tab', () => ({
  TemplatesTab: () => <div>templates-content</div>,
}))
vi.mock('@/modules/publisher/components/artifacts/artifacts-tab', () => ({
  ArtifactsTab: () => <div>artifacts-content</div>,
}))

import { AppDetail, visibleAppTabs } from '../components/app-detail'

function makeApp(over: Partial<App> = {}): App {
  const urls = { app: null, connect: null, switchboard: null }
  return {
    id: 'app-1', slug: 'vault', name: 'Vault', ownerAddress: '0xme', status: 'ACTIVE',
    repository: { installationId: '1', repositoryId: '2', fullName: 'acme/vault' },
    productionBranch: 'main', productionEnvironmentId: 'env-prod', previewsEnabled: false,
    previewLimit: 0, previewTtlDays: 0, harborProject: 'acme', identityDid: 'did:key:z',
    renownAuthorizeUrl: 'https://renown/authorize', identityExpiresAt: null, productionUrls: urls,
    previews: [], latestDeployment: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    ...over,
  }
}

const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, '').trim())

describe('AppDetail tabs', () => {
  beforeEach(() => {
    cleanup()
    searchParams = new URLSearchParams()
    app = makeApp()
    publisher = { isPublisher: true, app: { id: 'app-1', name: 'Vault', status: 'ACTIVE' }, isPending: false }
  })

  it('computes the tab list from ownership and read-only state', () => {
    expect(visibleAppTabs({ readOnly: false, isPublisher: true })).toEqual([
      'overview', 'deployments', 'artifacts', 'templates', 'settings',
    ])
    expect(visibleAppTabs({ readOnly: false, isPublisher: false })).toEqual(['overview', 'deployments', 'settings'])
    expect(visibleAppTabs({ readOnly: true, isPublisher: true })).toEqual(['overview', 'deployments'])
  })

  it('shows licensing tabs to the publisher, with readable labels', () => {
    render(<AppDetail appId="app-1" />)
    expect(tabNames()).toEqual(['Overview', 'Deployments', 'Artifacts', 'Templates', 'Settings'])
  })

  it('opens a licensing tab from the URL', () => {
    searchParams = new URLSearchParams('tab=artifacts')
    render(<AppDetail appId="app-1" />)
    expect(screen.getByText('artifacts-content')).toBeTruthy()
  })

  it('hides licensing tabs from anyone else and ignores a deep link to them', () => {
    publisher = { isPublisher: false, app: undefined, isPending: false }
    searchParams = new URLSearchParams('tab=artifacts')
    render(<AppDetail appId="app-1" />)
    expect(tabNames()).toEqual(['Overview', 'Deployments', 'Settings'])
    expect(screen.queryByText('artifacts-content')).toBeNull()
    expect(screen.getByText('overview-content')).toBeTruthy()
  })

  it('shows the paused-licensing banner on a licensing tab of an inactive app', () => {
    publisher = { isPublisher: true, app: { id: 'app-1', name: 'Vault', status: 'PENDING_IDENTITY' }, isPending: false }
    searchParams = new URLSearchParams('tab=artifacts')
    render(<AppDetail appId="app-1" />)
    expect(screen.getByText('Licensing is paused for this app')).toBeTruthy()
  })

  it('does not show the paused banner on Overview', () => {
    publisher = { isPublisher: true, app: { id: 'app-1', name: 'Vault', status: 'PENDING_IDENTITY' }, isPending: false }
    render(<AppDetail appId="app-1" />)
    expect(screen.queryByText('Licensing is paused for this app')).toBeNull()
  })
})
