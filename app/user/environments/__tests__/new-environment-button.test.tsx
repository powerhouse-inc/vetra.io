import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'

let activeOrg: { id: string; name: string; role: string } | null = null

vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useActiveOrg: () => ({
    orgId: activeOrg?.id ?? null,
    org: activeOrg,
    orgs: [],
    isLoading: false,
    setActiveOrg: vi.fn(),
  }),
}))

import { NewEnvironmentButton } from '../new-environment-button'

describe('NewEnvironmentButton', () => {
  beforeEach(() => cleanup())
  afterEach(() => {
    activeOrg = null
  })

  it('is disabled for a plain member, saying who can create', () => {
    activeOrg = { id: 'o1', name: 'Acme', role: 'MEMBER' }
    render(<NewEnvironmentButton />)
    expect(screen.queryByRole('link', { name: 'New environment' })).toBeNull()
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'New environment' })
    expect(button.disabled).toBe(true)
    expect(button.parentElement?.getAttribute('title')).toBe(
      'Ask an owner or admin of Acme to create environments',
    )
  })

  it('links to the form for an admin and for a personal account', () => {
    activeOrg = { id: 'o1', name: 'Acme', role: 'ADMIN' }
    render(<NewEnvironmentButton />)
    expect(screen.getByRole('link', { name: 'New environment' }).getAttribute('href')).toBe(
      '/user/environments/new',
    )
    cleanup()
    activeOrg = null
    render(<NewEnvironmentButton />)
    expect(screen.getByRole('link', { name: 'New environment' })).toBeTruthy()
  })
})
