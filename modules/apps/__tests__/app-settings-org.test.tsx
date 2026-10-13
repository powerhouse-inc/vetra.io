import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { App } from '../types'

const mine = vi.hoisted(() => ({ data: [] as unknown[], lookup: true }))
vi.mock('@/modules/orgs/components/org-badge', () => ({
  OrgBadge: ({ orgId }: { orgId: string }) => <span>badge:{orgId}</span>,
}))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useMyOrgs: () => ({ data: mine.data }),
  useOrgSummary: (id: string | null) => ({
    data: id && mine.lookup ? { id, handle: 'acme' } : undefined,
  }),
}))
import { OrganisationCard } from '../components/app-settings'

const app = (over: Partial<App> = {}) =>
  ({ id: 'a1', name: 'Shop', identityDid: 'did:key:zShop', ownerOrgId: null, ...over }) as App

afterEach(() => {
  cleanup()
  mine.lookup = true
})

describe('OrganisationCard', () => {
  it('links one transfer per managed org plus the general one', () => {
    mine.data = [
      { id: 'o1', handle: 'acme', name: 'Acme', role: 'ADMIN' },
      { id: 'o2', handle: 'beta', name: 'Beta', role: 'MEMBER' },
    ]
    render(<OrganisationCard app={app()} />)
    expect(screen.getByRole('link', { name: 'Transfer to Acme' }).getAttribute('href')).toContain(
      '/org/acme/manage/apps?bring=did%3Akey%3AzShop',
    )
    expect(screen.queryByRole('link', { name: 'Transfer to Beta' })).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Transfer to an organisation' }).getAttribute('href'),
    ).toContain('/me#app-transfers')
  })

  it('shows the owning org and its manage link, no transfer', () => {
    render(<OrganisationCard app={app({ ownerOrgId: 'o1' })} />)
    expect(screen.getByText('badge:o1')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Manage on Renown' }).getAttribute('href')).toContain(
      '/org/acme/manage/apps',
    )
    expect(screen.queryByRole('link', { name: /Transfer/ })).toBeNull()
  })

  it('falls back to the organisations list when the handle lookup fails', () => {
    mine.lookup = false
    render(<OrganisationCard app={app({ ownerOrgId: 'o1' })} />)
    expect(
      screen.getByRole('link', { name: 'Your organisations on Renown' }).getAttribute('href'),
    ).toContain('/me#organisations')
  })

  it('offers no ?bring= links without an identity DID', () => {
    mine.data = [{ id: 'o1', handle: 'acme', name: 'Acme', role: 'OWNER' }]
    render(<OrganisationCard app={app({ identityDid: '' })} />)
    expect(screen.queryByRole('link', { name: 'Transfer to Acme' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Transfer to an organisation' })).toBeTruthy()
  })

  it('links to creating an organisation when the user administers none', () => {
    mine.data = [{ id: 'o2', handle: 'beta', name: 'Beta', role: 'MEMBER' }]
    render(<OrganisationCard app={app()} />)
    expect(
      screen.getByRole('link', { name: 'Create an organisation' }).getAttribute('href'),
    ).toContain('/org/new')
  })
})
