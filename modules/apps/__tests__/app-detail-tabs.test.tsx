import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { App } from '../types'

let searchParams = new URLSearchParams()
type PublisherState = {
  isPublisher: boolean
  app?: { id: string; name: string; status: string }
  isPending: boolean
  error?: unknown
  retry?: () => void
  retrying?: boolean
}
let publisher: PublisherState = {
  isPublisher: true,
  app: { id: 'app-1', name: 'Vault', status: 'ACTIVE' },
  isPending: false,
}
let app: App
let appError: Error | null = null
/** The apps record behind a licensing-only app: null for Vetra Studio, which has none. */
let appRecord: { id: string; status: string } | null = null
type Access = { operate: boolean; release: boolean; administer: boolean; releaseManager: boolean }
const OWNER: Access = { operate: true, release: true, administer: true, releaseManager: false }
const RELEASE_MANAGER: Access = {
  operate: false,
  release: true,
  administer: false,
  releaseManager: true,
}
/** appAccess: data, or an error. */
let access: { data?: Access; error?: Error } = { data: OWNER }

vi.mock('@/modules/apps/hooks/use-app-profile', () => ({
  useAppName: (_did: unknown, fallback: string) => fallback,
  useAppLogo: () => null,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/user/apps/app-1',
  useSearchParams: () => searchParams,
}))
vi.mock('@powerhousedao/reactor-browser', () => ({
  useRenownAuthAsync: () => ({ state: 'authenticated' }),
}))
vi.mock('../hooks/use-apps', () => ({
  useApp: () =>
    appError
      ? { data: undefined, isPending: false, error: appError }
      : { data: app, isPending: false, error: null },
  useAppDeployments: () => ({ data: [], isPending: false, error: null }),
  useGithubDeployAppInfo: () => ({ data: undefined }),
  useConfirmAppIdentity: () => ({ mutate: vi.fn(), isPending: false }),
  useAppRecord: () => ({ data: appRecord }),
  useAppAccess: () => ({
    data: access.data,
    error: access.error ?? null,
    isPending: !access.data && !access.error,
  }),
}))
vi.mock('@/modules/publisher/hooks/use-publisher', () => ({
  useAppPublisher: () => publisher,
}))
vi.mock('@/modules/orgs/components/org-badge', () => ({ OrgBadge: () => null }))
vi.mock('@/modules/publisher/components/publisher-summary', () => ({
  PublisherSummaryRow: () => null,
}))
vi.mock('../components/app-overview', () => ({ AppOverview: () => <div>overview-content</div> }))
vi.mock('../components/app-deployments', () => ({
  AppDeployments: () => <div>deployments-content</div>,
}))
vi.mock('../components/app-environment', () => ({
  AppEnvironment: ({ appId }: { appId: string }) => <div>environment-content {appId}</div>,
}))
vi.mock('../components/app-audit', () => ({
  AppAudit: ({ appId }: { appId: string }) => <div>audit-content {appId}</div>,
}))
vi.mock('../components/app-plans', () => ({
  AppPlans: ({ appId }: { appId: string }) => <div>release-plans-content {appId}</div>,
}))
vi.mock('../components/app-settings', () => ({
  AppSettings: ({ canAdminister }: { canAdminister?: boolean }) => (
    <div>settings-content{canAdminister ? ' with access' : ''}</div>
  ),
  DeleteAppCard: ({ app }: { app: { id: string } }) => <div>delete-content {app.id}</div>,
}))
vi.mock('../components/profile/profile-tab', () => ({
  AppProfileTab: ({ appDid }: { appDid: string | null }) => (
    <div>profile-content {appDid ?? 'none'}</div>
  ),
}))
vi.mock('../components/app-releases', () => ({
  AppReleases: ({ appId, repository }: { appId: string; repository: string | null }) => (
    <div>
      releases-content {appId} {repository}
    </div>
  ),
}))
vi.mock('../components/github-flow-link', () => ({ GithubFlowLink: () => null }))
vi.mock('@/modules/publisher/components/plans/plans-tab', () => ({
  PlansTab: () => <div>plans-content</div>,
}))
vi.mock('@/modules/publisher/components/templates/templates-tab', () => ({
  TemplatesTab: () => <div>templates-content</div>,
}))
vi.mock('@/modules/publisher/components/holders/holders-tab', () => ({
  HoldersTab: () => <div>holders-content</div>,
}))
vi.mock('@/modules/publisher/components/invite-codes/invite-codes-tab', () => ({
  InviteCodesTab: () => <div>invite-codes-content</div>,
}))
vi.mock('@/modules/publisher/components/artifacts/artifacts-tab', () => ({
  ArtifactsTab: () => <div>artifacts-content</div>,
}))

import { AppDetail, missingAppView, visibleAppTabs } from '../components/app-detail'
import { AppsApiError } from '../graphql'

function makeApp(over: Partial<App> = {}): App {
  const urls = { app: null, connect: null, switchboard: null }
  return {
    id: 'app-1',
    slug: 'vault',
    name: 'Vault',
    ownerAddress: '0xme',
    status: 'ACTIVE',
    repository: { installationId: '1', repositoryId: '2', fullName: 'acme/vault' },
    productionBranch: 'main',
    productionEnvironmentId: 'env-prod',
    previewsEnabled: false,
    previewLimit: 0,
    previewTtlDays: 0,
    harborProject: 'acme',
    identityDid: 'did:key:z',
    renownAuthorizeUrl: 'https://renown/authorize',
    identityExpiresAt: null,
    productionUrls: urls,
    previews: [],
    latestDeployment: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...over,
  }
}

const tabNames = () =>
  screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, '').trim())

describe('AppDetail tabs', () => {
  beforeEach(() => {
    cleanup()
    searchParams = new URLSearchParams()
    app = makeApp()
    appError = null
    appRecord = null
    access = { data: OWNER }
    publisher = {
      isPublisher: true,
      app: { id: 'app-1', name: 'Vault', status: 'ACTIVE' },
      isPending: false,
    }
  })

  it('computes the tab list from ownership', () => {
    expect(visibleAppTabs({ isPublisher: true })).toEqual([
      'overview',
      'deployments',
      'profile',
      'releases',
      'artifacts',
      'templates',
      'plans',
      'holders',
      'invite-codes',
      'environment',
      'settings',
    ])
    expect(visibleAppTabs({ isPublisher: true, access: OWNER, releaseManagers: true })).toContain(
      'audit',
    )
    expect(visibleAppTabs({ isPublisher: false })).toEqual([
      'overview',
      'deployments',
      'profile',
      'releases',
      'environment',
      'settings',
    ])
  })

  it('shows licensing tabs to the publisher, with readable labels', () => {
    render(<AppDetail appId="app-1" />)
    expect(tabNames()).toEqual([
      'Overview',
      'Deployments',
      'Profile',
      'Releases',
      'Artifacts',
      'Templates',
      'Plans',
      'Holders',
      'Invite codes',
      'Environment',
      'Audit log',
      'Settings',
    ])
  })

  it('opens a licensing tab from the URL', () => {
    searchParams = new URLSearchParams('tab=artifacts')
    render(<AppDetail appId="app-1" />)
    expect(screen.getByText('artifacts-content')).toBeTruthy()
  })

  it('opens the Releases tab from the URL, for anyone who can view the app', () => {
    publisher = { isPublisher: false, app: undefined, isPending: false }
    searchParams = new URLSearchParams('tab=releases')
    render(<AppDetail appId="app-1" />)
    expect(screen.getByText('releases-content app-1 acme/vault')).toBeTruthy()
  })

  it('hides Releases for an app without a repository and ignores a deep link to it', () => {
    expect(visibleAppTabs({ isPublisher: false, hasRepository: false })).not.toContain('releases')
    app = makeApp({ repository: null as unknown as App['repository'] })
    searchParams = new URLSearchParams('tab=releases')
    render(<AppDetail appId="app-1" />)
    expect(tabNames()).not.toContain('Releases')
    expect(screen.queryByText(/releases-content/)).toBeNull()
    expect(screen.getByText('overview-content')).toBeTruthy()
  })

  it('opens the Environment tab from the URL, and hides it without a repository', () => {
    searchParams = new URLSearchParams('tab=environment')
    render(<AppDetail appId="app-1" />)
    expect(screen.getByText('environment-content app-1')).toBeTruthy()
    cleanup()
    expect(visibleAppTabs({ isPublisher: true, hasRepository: false })).not.toContain('environment')
    app = makeApp({ repository: null as unknown as App['repository'] })
    render(<AppDetail appId="app-1" />)
    expect(tabNames()).not.toContain('Environment')
    expect(screen.queryByText(/environment-content/)).toBeNull()
  })

  it('opens the Profile tab with the app identity', () => {
    searchParams = new URLSearchParams('tab=profile')
    render(<AppDetail appId="app-1" />)
    expect(screen.getByText(`profile-content ${app.identityDid}`)).toBeTruthy()
  })

  it('gives a licensing-only app a Profile tab too', () => {
    appError = new AppsApiError('NOT_FOUND', 'no such app', 404)
    publisher = {
      isPublisher: true,
      app: { id: 'studio-1', name: 'Vetra Studio', status: 'ACTIVE' },
      isPending: false,
    }
    searchParams = new URLSearchParams('tab=profile')
    render(<AppDetail appId="studio-1" />)
    expect(screen.getByText('profile-content none')).toBeTruthy()
  })

  it('lets the publisher delete a licensing-only app that has an apps record', () => {
    appError = new AppsApiError('NOT_FOUND', 'no such app', 404)
    appRecord = { id: 'dao', status: 'ACTIVE' }
    publisher = {
      isPublisher: true,
      app: { id: 'dao', name: 'DAO Treasury', status: 'ACTIVE' },
      isPending: false,
    }
    searchParams = new URLSearchParams('tab=settings')
    render(<AppDetail appId="dao" />)
    expect(tabNames()).toContain('Settings')
    expect(screen.getByText('delete-content dao')).toBeTruthy()
  })

  it('offers no Settings on Vetra Studio, which has no apps record', () => {
    appError = new AppsApiError('NOT_FOUND', 'no such app', 404)
    publisher = {
      isPublisher: true,
      app: { id: 'studio-1', name: 'Vetra Studio', status: 'ACTIVE' },
      isPending: false,
    }
    searchParams = new URLSearchParams('tab=settings')
    render(<AppDetail appId="studio-1" />)
    expect(tabNames()).not.toContain('Settings')
    expect(screen.queryByText(/delete-content/)).toBeNull()
  })

  it('hides licensing tabs from anyone else and ignores a deep link to them', () => {
    publisher = { isPublisher: false, app: undefined, isPending: false }
    searchParams = new URLSearchParams('tab=artifacts')
    render(<AppDetail appId="app-1" />)
    expect(tabNames()).toEqual([
      'Overview',
      'Deployments',
      'Profile',
      'Releases',
      'Plans',
      'Environment',
      'Audit log',
      'Settings',
    ])
    expect(screen.queryByText('artifacts-content')).toBeNull()
    expect(screen.getByText('overview-content')).toBeTruthy()
  })

  it('shows the paused-licensing banner on a licensing tab of an inactive app', () => {
    publisher = {
      isPublisher: true,
      app: { id: 'app-1', name: 'Vault', status: 'PENDING_IDENTITY' },
      isPending: false,
    }
    searchParams = new URLSearchParams('tab=artifacts')
    render(<AppDetail appId="app-1" />)
    expect(screen.getByText('Licensing is paused for this app')).toBeTruthy()
  })

  it('names the next step in the paused banner instead of a raw status', () => {
    publisher = {
      isPublisher: true,
      app: { id: 'app-1', name: 'Vault', status: 'PENDING_IDENTITY' },
      isPending: false,
    }
    searchParams = new URLSearchParams('tab=artifacts')
    render(<AppDetail appId="app-1" />)
    expect(screen.getByText(/Authorize this app on Renown first/)).toBeTruthy()
    expect(screen.queryByText(/pending identity/i)).toBeNull()
  })

  it('holds a deep-linked licensing tab on a skeleton while ownership loads', () => {
    publisher = { isPublisher: false, app: undefined, isPending: true }
    searchParams = new URLSearchParams('tab=holders')
    render(<AppDetail appId="app-1" />)
    expect(screen.getByRole('status', { name: 'Loading Holders' })).toBeTruthy()
    expect(screen.queryByText('overview-content')).toBeNull()
  })

  it('says so, with a retry, when the ownership check fails', () => {
    const retry = vi.fn()
    publisher = {
      isPublisher: false,
      app: undefined,
      isPending: false,
      error: new Error('boom'),
      retry,
      retrying: false,
    }
    searchParams = new URLSearchParams('tab=plans')
    render(<AppDetail appId="app-1" />)
    expect(screen.getByText('Your plans and invite codes did not load')).toBeTruthy()
    // Without the licensing tabs, an operator still gets the plans Vetra runs.
    expect(screen.getByText('release-plans-content app-1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('does not show the paused banner on Overview', () => {
    publisher = {
      isPublisher: true,
      app: { id: 'app-1', name: 'Vault', status: 'PENDING_IDENTITY' },
      isPending: false,
    }
    render(<AppDetail appId="app-1" />)
    expect(screen.queryByText('Licensing is paused for this app')).toBeNull()
  })

  describe('access', () => {
    beforeEach(() => {
      publisher = { isPublisher: false, app: undefined, isPending: false }
    })

    it('shows a release manager Plans, Environment, Audit log and Releases, but no Settings', () => {
      access = { data: RELEASE_MANAGER }
      render(<AppDetail appId="app-1" />)
      expect(tabNames()).toEqual([
        'Overview',
        'Deployments',
        'Releases',
        'Plans',
        'Environment',
        'Audit log',
      ])
      cleanup()
      searchParams = new URLSearchParams('tab=plans')
      render(<AppDetail appId="app-1" />)
      expect(screen.getByText('release-plans-content app-1')).toBeTruthy()
      cleanup()
      searchParams = new URLSearchParams('tab=settings')
      render(<AppDetail appId="app-1" />)
      expect(screen.queryByText(/settings-content/)).toBeNull()
      expect(screen.getByText('overview-content')).toBeTruthy()
    })

    it('hides the identity banner from someone who cannot act on it', () => {
      access = { data: RELEASE_MANAGER }
      app = makeApp({ status: 'PENDING_IDENTITY' })
      render(<AppDetail appId="app-1" />)
      expect(screen.queryByText('Authorize the deploy identity')).toBeNull()
    })

    it('opens the Audit log from the URL, and gives admins the Access card', () => {
      searchParams = new URLSearchParams('tab=audit')
      render(<AppDetail appId="app-1" />)
      expect(screen.getByText('audit-content app-1')).toBeTruthy()
      cleanup()
      searchParams = new URLSearchParams('tab=settings')
      render(<AppDetail appId="app-1" />)
      expect(screen.getByText('settings-content with access')).toBeTruthy()
    })

    it('holds a deep link to the Audit log while access loads', () => {
      access = {}
      searchParams = new URLSearchParams('tab=audit')
      render(<AppDetail appId="app-1" />)
      expect(screen.getByRole('status', { name: 'Loading Audit log' })).toBeTruthy()
    })

    it('treats a refused access check as no access', () => {
      access = { error: new AppsApiError('FORBIDDEN', 'no') }
      render(<AppDetail appId="app-1" />)
      expect(tabNames()).toEqual(['Overview', 'Deployments', 'Releases', 'Audit log'])
    })

    it('keeps the page as it was on a backend without appAccess', () => {
      access = { error: new AppsApiError('APPS_UNAVAILABLE', 'Cannot query field "appAccess"') }
      render(<AppDetail appId="app-1" />)
      expect(tabNames()).toEqual([
        'Overview',
        'Deployments',
        'Profile',
        'Releases',
        'Environment',
        'Settings',
      ])
      cleanup()
      searchParams = new URLSearchParams('tab=settings')
      render(<AppDetail appId="app-1" />)
      expect(screen.getByText('settings-content')).toBeTruthy()
    })
  })

  describe('an app that exists only for licensing', () => {
    const studio = { id: 'studio-1', name: 'Vetra Studio', status: 'ACTIVE' }
    beforeEach(() => {
      appError = new AppsApiError('NOT_FOUND', 'no such app', 404)
    })

    it('picks the page from both answers', () => {
      const v = (o: Partial<Parameters<typeof missingAppView>[0]>) =>
        missingAppView({ notFound: true, publisherPending: false, isPublisher: false, ...o })
      expect(v({ isPublisher: true })).toBe('licensing-only')
      expect(v({ publisherPending: true })).toBe('checking')
      expect(v({})).toBe('not-found')
      expect(v({ notFound: false, isPublisher: true })).toBe('error')
      // A failed myApps check is not a "no": never claim the app does not exist.
      expect(v({ publisherError: true })).toBe('unchecked')
      expect(v({ publisherError: true, isPublisher: true })).toBe('licensing-only')
      expect(v({ publisherError: true, publisherPending: true })).toBe('checking')
      expect(v({ notFound: false, publisherError: true })).toBe('error')
    })

    it('offers a retry, not "not found", when the ownership check failed', () => {
      const retry = vi.fn()
      publisher = {
        isPublisher: false,
        app: undefined,
        isPending: false,
        error: new Error('network down'),
        retry,
        retrying: false,
      }
      render(<AppDetail appId="studio-1" />)
      expect(screen.getByText('We couldn’t check whether you publish this app')).toBeTruthy()
      expect(screen.queryByText('App not found')).toBeNull()
      expect(screen.queryByText(/belongs to another account/)).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(retry).toHaveBeenCalledTimes(1)
    })

    it('shows only the licensing tabs, opening on the first (Profile), for its publisher', () => {
      publisher = { isPublisher: true, app: studio, isPending: false }
      render(<AppDetail appId="studio-1" />)
      expect(screen.getByRole('heading', { name: 'Vetra Studio' })).toBeTruthy()
      expect(tabNames()).toEqual(['Profile', 'Templates', 'Plans', 'Holders', 'Invite codes'])
      expect(screen.getByRole('tab', { name: 'Profile' }).getAttribute('aria-selected')).toBe(
        'true',
      )
      expect(screen.getByText(/profile-content/)).toBeTruthy()
      expect(screen.queryByRole('link', { name: /visit/i })).toBeNull()
      expect(screen.queryByText('acme/vault')).toBeNull()
      expect(screen.queryByText('App not found')).toBeNull()
    })

    it('follows a deep link to another licensing tab, but never to Overview or Settings', () => {
      publisher = { isPublisher: true, app: studio, isPending: false }
      searchParams = new URLSearchParams('tab=invite-codes')
      render(<AppDetail appId="studio-1" />)
      expect(screen.getByText('invite-codes-content')).toBeTruthy()
      cleanup()
      searchParams = new URLSearchParams('tab=plans')
      render(<AppDetail appId="studio-1" />)
      expect(screen.getByText('plans-content')).toBeTruthy()
      cleanup()
      searchParams = new URLSearchParams('tab=settings')
      render(<AppDetail appId="studio-1" />)
      expect(screen.getByText(/profile-content/)).toBeTruthy()
    })

    it('waits for the ownership check instead of saying "not found"', () => {
      publisher = { isPublisher: false, app: undefined, isPending: true }
      render(<AppDetail appId="studio-1" />)
      expect(screen.getByRole('status', { name: 'Loading app' })).toBeTruthy()
      expect(screen.queryByText('App not found')).toBeNull()
    })

    it('says "not found" only when both agree', () => {
      publisher = { isPublisher: false, app: undefined, isPending: false }
      render(<AppDetail appId="studio-1" />)
      expect(screen.getByText('App not found')).toBeTruthy()
    })
  })
})
