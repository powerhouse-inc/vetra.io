import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { App } from '../types'

// The Renown profile names, by identity: apps show these, never their record's name.
const PROFILE_NAMES: Record<string, string> = { 'did:key:kv': 'Knowledge Vault' }
const PROFILE_LOGOS: Record<string, string> = { 'did:key:kv': 'https://renown.test/media/kv/logo' }
vi.mock('../hooks/use-app-profile', () => ({
  useAppName: (did: string | null | undefined, fallback: string) =>
    (did && PROFILE_NAMES[did]) || fallback,
  useAppLogo: (did: string | null | undefined) => (did && PROFILE_LOGOS[did]) || null,
}))

import { AppCard } from '../components/app-card'
import { LicensingOnlyAppCard } from '../components/licensing-only-app-card'

const app = (over: Partial<App>): App =>
  ({
    id: 'a1',
    name: 'bai-knowledge-note',
    identityDid: 'did:key:kv',
    status: 'ACTIVE',
    repository: { installationId: '1', repositoryId: '2', fullName: 'acme/bai-knowledge-note' },
    productionBranch: 'main',
    productionUrls: [],
    latestDeployment: null,
    previews: [],
    ...over,
  }) as App

describe('app names come from Renown', () => {
  it('an app card shows the profile name, not the record name', () => {
    render(<AppCard app={app({})} />)
    expect(screen.getByRole('link', { name: 'Knowledge Vault' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'bai-knowledge-note' })).toBeNull()
  })

  it('an app card without a profile keeps its record name', () => {
    render(<AppCard app={app({ id: 'a2', name: 'shop', identityDid: 'did:key:none' })} />)
    expect(screen.getByRole('link', { name: 'shop' })).toBeTruthy()
  })

  it('a licensing-only card shows the profile name', () => {
    render(
      <LicensingOnlyAppCard
        app={{ id: 'dao', name: 'dao-treasury', status: 'ACTIVE', identityDid: 'did:key:kv' }}
      />,
    )
    expect(screen.getByRole('link', { name: 'Knowledge Vault' })).toBeTruthy()
  })

  it("cards show the app's Renown logo, and the monogram without one", () => {
    render(<AppCard app={app({})} />)
    expect(screen.getByRole('img', { name: 'Knowledge Vault logo' }).getAttribute('src')).toBe(
      'https://renown.test/media/kv/logo',
    )
    render(
      <LicensingOnlyAppCard
        app={{ id: 'dao', name: 'dao-treasury', status: 'ACTIVE', identityDid: 'did:key:none' }}
      />,
    )
    expect(screen.queryByRole('img', { name: 'dao-treasury logo' })).toBeNull()
    // No logo, but a Renown identity: renown.id's avatar generated from the app's DID.
    expect(screen.getByRole('img', { name: 'Generated avatar' })).toBeTruthy()
  })

  it('keeps the monogram for an app with no Renown identity at all', () => {
    render(
      <LicensingOnlyAppCard
        app={{ id: 'new', name: 'new-app', status: 'ACTIVE', identityDid: null }}
      />,
    )
    expect(screen.queryByRole('img', { name: 'Generated avatar' })).toBeNull()
  })
})
