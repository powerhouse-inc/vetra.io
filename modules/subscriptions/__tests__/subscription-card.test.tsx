import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { Subscription } from '../types'
import { SubscriptionCard } from '../components/subscription-card'

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  licenseId: 'l1',
  appId: 'kv',
  appName: 'Knowledge Vault',
  kind: 'kv-pro',
  termLabel: 'Pro',
  issuer: 'INVITE_CODE',
  status: 'ACTIVE',
  start: '2026-10-01T00:00:00Z',
  end: '2026-10-31T00:00:00Z',
  mode: 'DEDICATED',
  environmentId: 'env-1',
  environmentLabel: 'Acme research',
  openUrl: 'https://acme.kv.vetra.io',
  stoppedAt: null,
  deleteAfter: null,
  warnings: [],
  ...over,
})

describe('SubscriptionCard', () => {
  beforeEach(() => {
    cleanup()
  })

  it('shows plan, status, environment and an Open button', () => {
    render(<SubscriptionCard subscription={sub()} highlighted={false} onCancel={vi.fn()} />)
    expect(screen.getByText('Pro')).toBeTruthy()
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Acme research' }).getAttribute('href')).toBe(
      '/user/environments/env-1',
    )
    const open = screen.getByRole('link', { name: /open/i })
    expect(open.getAttribute('href')).toBe('https://acme.kv.vetra.io')
    expect(open.getAttribute('target')).toBe('_blank')
  })

  it('shows every warning as a banner', () => {
    render(
      <SubscriptionCard
        subscription={sub({
          warnings: [
            {
              kind: 'EXPIRING',
              at: '2026-10-31T00:00:00Z',
              message: 'Your licence ends on Oct 31.',
            },
            {
              kind: 'DELETE_IMMINENT',
              at: '2027-01-29T00:00:00Z',
              message: 'Your environment is deleted tomorrow.',
            },
          ],
        })}
        highlighted={false}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Your licence ends on Oct 31.')).toBeTruthy()
    expect(screen.getByText('Your environment is deleted tomorrow.')).toBeTruthy()
  })

  it('offers Cancel only while live', () => {
    const onCancel = vi.fn()
    const { rerender } = render(
      <SubscriptionCard subscription={sub()} highlighted={false} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Pro on Knowledge Vault' }))
    expect(onCancel).toHaveBeenCalled()
    rerender(
      <SubscriptionCard
        subscription={sub({ status: 'EXPIRED' })}
        highlighted={false}
        onCancel={onCancel}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Cancel Pro on Knowledge Vault' })).toBeNull()
  })

  it('describes a shared plan without an environment link', () => {
    render(
      <SubscriptionCard
        subscription={sub({ mode: 'SHARED', environmentId: null, environmentLabel: null })}
        highlighted={false}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('An account on Knowledge Vault')).toBeTruthy()
  })

  it('says a new environment is on its way', () => {
    render(
      <SubscriptionCard
        subscription={sub({
          status: 'ISSUED',
          environmentId: null,
          environmentLabel: null,
          openUrl: null,
        })}
        highlighted={false}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/your environment is being set up/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull()
  })

  it('does not offer Open for an ended subscription, even with a URL', () => {
    render(
      <SubscriptionCard
        subscription={sub({ status: 'REVOKED' })}
        highlighted={false}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull()
  })
})
