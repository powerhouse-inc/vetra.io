import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { PublisherApiError } from '../graphql'

// On a deployment with licensing switched off, READS still work and every
// mutation refuses. The dashboard must look normal and fail only on the action:
// that is the designed state, not a broken page.
const toastError = vi.fn()
const refusal = 'licensing is disabled on this deployment'
const retire = vi.fn()

vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }))
vi.mock('../hooks/use-publisher', () => ({
  usePublisherLicenseTypes: () => ({
    data: [
      { id: 'lt-1', kind: 'PRO', label: 'Pro', status: 'ACTIVE', validityDays: 365, templateHash: 'h', services: [], packages: [] },
      { id: 'lt-2', kind: 'TEAM', label: 'Team', status: 'DRAFT', validityDays: 30, templateHash: 'h', services: [], packages: [] },
    ],
    isPending: false,
    error: null,
  }),
}))
vi.mock('../hooks/use-publisher-mutations', () => {
  const refuse = { mutateAsync: (...a: unknown[]) => retire(...a), isPending: false }
  return {
    useCreateLicenseType: () => refuse, useSetLicenseTypeDetails: () => refuse,
    useSetLicenseTypeTemplate: () => refuse, useAddLicenseTypeService: () => refuse,
    useAddLicenseTypePackage: () => refuse, usePublishLicenseType: () => refuse,
    useRetireLicenseType: () => refuse,
  }
})

import { TiersTab } from '../components/tiers-tab'

beforeEach(() => {
  cleanup()
  toastError.mockReset()
  retire.mockReset()
  retire.mockRejectedValue(new PublisherApiError('LICENSING_DISABLED', refusal, null))
})

describe('a deployment with licensing disabled', () => {
  it('still renders every tier rather than an error page', () => {
    render(<TiersTab appId="a1" />)
    expect(screen.getByText('Pro')).toBeTruthy()
    expect(screen.getByText('Team')).toBeTruthy()
    expect(screen.getByRole('button', { name: /retire/i })).toBeTruthy()
  })

  it('fails only on the action: the refusal is shown and the list stays', async () => {
    render(<TiersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /^retire$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /retire tier/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(refusal))
    expect(retire).toHaveBeenCalled()
    expect(screen.getByText('Pro')).toBeTruthy()
    expect(screen.getByText('Team')).toBeTruthy()
  })
})
