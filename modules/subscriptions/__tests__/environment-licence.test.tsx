import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import type { Subscription } from '../types'

let found: Subscription | undefined
vi.mock('../hooks/use-subscriptions', () => ({
  useSubscriptionForEnvironment: () => ({ subscription: found, isPending: false }),
}))

import { EnvironmentLicenceBadge, EnvironmentLicenceBanner } from '../components/environment-licence'

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  licenseId: 'l1', appId: 'kv', appName: 'Knowledge Vault', kind: 'kv-pro', termLabel: 'Pro',
  issuer: 'INVITE_CODE', status: 'ACTIVE', start: null, end: null, mode: 'DEDICATED', environmentId: 'env-1',
  environmentLabel: 'Acme', openUrl: null, stoppedAt: null, deleteAfter: null, warnings: [], ...over,
})

describe('environment licence', () => {
  beforeEach(() => {
    cleanup()
  })

  it('renders nothing for a hand-made environment', () => {
    found = undefined
    const { container } = render(<><EnvironmentLicenceBadge environmentId="env-x" /><EnvironmentLicenceBanner environmentId="env-x" /></>)
    expect(container.textContent).toBe('')
  })

  it('names the app and plan and links the subscription', () => {
    found = sub()
    render(<EnvironmentLicenceBadge environmentId="env-1" />)
    expect(screen.getByText('Knowledge Vault · Pro')).toBeTruthy()
    expect(screen.getByRole('link', { name: /subscription/i }).getAttribute('href')).toBe('/user/subscriptions?highlight=l1')
  })

  it('shows the offboarding state on the detail banner', () => {
    found = sub({
      status: 'REVOKED',
      stoppedAt: '2026-10-22T00:00:00Z',
      warnings: [{ kind: 'STOPPED_DELETE_PENDING', at: '2027-01-20T00:00:00Z', message: 'Deleted on Jan 20 unless you renew.' }],
    })
    render(<EnvironmentLicenceBanner environmentId="env-1" />)
    expect(screen.getByText('Deleted on Jan 20 unless you renew.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View subscription' }).getAttribute('href')).toBe('/user/subscriptions?highlight=l1')
  })
})
