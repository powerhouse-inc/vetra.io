import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { LicensingOnlyAppCard } from '../components/licensing-only-app-card'
import { licensingOnlyApps, licensingOnlyHref } from '../lib/licensing-only'

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
    // Exact ids only: no prefix, case or substring matches.
    expect(
      licensingOnlyApps(published, [{ id: 'VAULT' }, { id: 'stud' }, { id: 'beta-2' }]).length,
    ).toBe(3)
    expect(
      licensingOnlyApps(published, [{ id: 'vault' }, { id: 'studio' }, { id: 'beta' }]),
    ).toEqual([])
  })

  it('opens the card on the app plans, labelled as licensing only', () => {
    render(
      <LicensingOnlyAppCard app={{ id: 'studio-1', name: 'Vetra Studio', status: 'ACTIVE' }} />,
    )
    expect(screen.getByRole('link', { name: 'Vetra Studio' }).getAttribute('href')).toBe(
      '/user/apps/studio-1?tab=plans',
    )
    expect(screen.getByText('Licensing only')).toBeTruthy()
    expect(licensingOnlyHref('a b')).toBe('/user/apps/a%20b?tab=plans')
  })
})
