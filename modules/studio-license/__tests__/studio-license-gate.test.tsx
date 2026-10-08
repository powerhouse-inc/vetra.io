import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { PublisherApiError } from '@/modules/publisher/graphql'

let access: {
  data?: unknown
  isPending: boolean
  error: Error | null
  isRefetching?: boolean
  timedOut?: boolean
}
const refetch = vi.fn()
const retry = vi.fn()
vi.mock('@/modules/shared/components/renown/require-login', () => ({
  RequireLogin: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/modules/subscriptions/hooks/use-subscriptions', () => ({
  useStudioAccess: () => ({ timedOut: false, ...access, refetch, retry }),
}))

import { StudioLicenseGate } from '../components/studio-license-gate'

describe('StudioLicenseGate', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    localStorage.setItem('vetra_prealpha_ack', '1')
  })

  it('shows a skeleton while access is unknown, including the token-not-ready null', () => {
    access = { data: null, isPending: false, error: null }
    render(<StudioLicenseGate>studio</StudioLicenseGate>)
    expect(screen.getByRole('status', { name: /checking your studio access/i })).toBeTruthy()
    expect(screen.queryByText('studio')).toBeNull()
  })

  it('stops the skeleton after a while with a message and a retry', () => {
    access = { data: null, isPending: false, error: null, timedOut: true }
    render(<StudioLicenseGate>studio</StudioLicenseGate>)
    expect(screen.getByText('We couldn’t check your studio access')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Redeem a code' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('opens the studio for a licence holder', () => {
    access = {
      data: { allowed: true, licenseId: 'l', expires: null, hasAttachedKey: true },
      isPending: false,
      error: null,
    }
    render(<StudioLicenseGate>studio</StudioLicenseGate>)
    expect(screen.getByText('studio')).toBeTruthy()
  })

  it('points everyone else at /redeem', () => {
    access = {
      data: { allowed: false, licenseId: null, expires: null, hasAttachedKey: false },
      isPending: false,
      error: null,
    }
    render(<StudioLicenseGate>studio</StudioLicenseGate>)
    expect(screen.getByRole('heading', { name: /vetra studio is in early access/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Redeem a code' }).getAttribute('href')).toBe('/redeem')
  })

  it('never tells a licensed user to redeem a code when the check fails', () => {
    access = {
      data: undefined,
      isPending: false,
      error: new PublisherApiError('NETWORK', 'fetch failed', null),
    }
    render(<StudioLicenseGate>studio</StudioLicenseGate>)
    expect(screen.queryByRole('link', { name: 'Redeem a code' })).toBeNull()
    expect(screen.getByText(/lost the connection to vetra/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetch).toHaveBeenCalled()
  })

  it('shows the pre-alpha notice once per browser', () => {
    localStorage.removeItem('vetra_prealpha_ack')
    access = {
      data: { allowed: true, licenseId: 'l', expires: null, hasAttachedKey: true },
      isPending: false,
      error: null,
    }
    render(<StudioLicenseGate>studio</StudioLicenseGate>)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
