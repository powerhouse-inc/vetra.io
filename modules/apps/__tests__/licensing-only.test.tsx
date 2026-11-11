import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { LicensingOnlyAppCard } from '../components/licensing-only-app-card'
import { licensingOnlyApps, licensingOnlyHref } from '../lib/licensing-only'

vi.mock('@/modules/apps/hooks/use-app-profile', () => ({
  useAppName: (_did: unknown, fallback: string) => fallback,
  useAppLogo: () => null,
}))

describe('licensing-only apps', () => {
  it('lists published apps the apps API does not know, by name', () => {
    const published = [
      { id: 'vault', name: 'Knowledge Vault', status: 'ACTIVE' },
      { id: 'studio', name: 'Vetra Studio', status: 'ACTIVE' },
      { id: 'beta', name: 'Atlas', status: 'PENDING_IDENTITY' },
    ]
    expect(licensingOnlyApps(published, [{ id: 'vault' }]).map((a) => a.id)).toEqual([
      'beta',
      'studio',
    ])
    expect(licensingOnlyApps(undefined, [{ id: 'vault' }])).toEqual([])
    // A soft-deleted app is missing from myApps but is not licensing-only.
    expect(
      licensingOnlyApps(
        [...published, { id: 'gone', name: 'Achra', status: 'DELETED' }],
        [{ id: 'vault' }],
      ).map((a) => a.id),
    ).toEqual(['beta', 'studio'])
    // Exact ids only: no prefix, case or substring matches.
    expect(
      licensingOnlyApps(published, [{ id: 'VAULT' }, { id: 'stud' }, { id: 'beta-2' }]).length,
    ).toBe(3)
    expect(
      licensingOnlyApps(published, [{ id: 'vault' }, { id: 'studio' }, { id: 'beta' }]),
    ).toEqual([])
  })

  it('opens the card on the app page, labelled as licensing only', () => {
    render(
      <LicensingOnlyAppCard app={{ id: 'studio-1', name: 'Vetra Studio', status: 'ACTIVE' }} />,
    )
    expect(screen.getByRole('link', { name: 'Vetra Studio' }).getAttribute('href')).toBe(
      '/user/apps/studio-1',
    )
    expect(screen.getByText('Licensing only')).toBeTruthy()
    expect(licensingOnlyHref('a b')).toBe('/user/apps/a%20b')
  })
})
