import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import React from 'react'
import { PublisherApiError } from '../graphql'

// On a deployment with licensing switched off, READS still work and every
// mutation refuses. The dashboard must look normal and fail only on the action:
// that is the designed state, not a broken page.
const toastError = vi.fn()
const refusal = 'licensing is disabled on this deployment'
const retire = vi.fn()
// When set, merely CALLING a write hook throws: proves a read-only tab does not depend on write availability.
let writeHooksExplode = false

vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }))
vi.mock('../hooks/use-publisher', () => ({
  usePublisherLicenses: () => ({
    data: [
      { id: 'l-1', user: '0x1111111111111111111111111111111111111111', licenseTypeId: 'lt-1', status: 'ACTIVE', start: null, end: null, environmentId: 'env-1' },
      { id: 'l-2', user: '0x2222222222222222222222222222222222222222', licenseTypeId: 'lt-1', status: 'ACTIVE', start: null, end: null, environmentId: null },
    ],
    isPending: false,
    error: null,
  }),
  usePublisherEnvironments: () => ({
    data: [
      { appId: 'a1', user: '0xaaa', environmentId: 'env-one', licenseId: 'l-1', templateHash: 'h1' },
      { appId: 'a1', user: '0xbbb', environmentId: 'env-two', licenseId: 'l-2', templateHash: 'h2' },
    ],
    isPending: false,
    error: null,
  }),
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
  const guard = (): typeof refuse => {
    if (writeHooksExplode) throw new Error('a write hook was used by a read-only tab')
    return refuse
  }
  return {
    useIssueGrant: guard, useRevokeLicense: guard,
    useCreateLicenseType: () => refuse, useSetLicenseTypeDetails: () => refuse,
    useSetLicenseTypeTemplate: () => refuse, useAddLicenseTypeService: () => refuse,
    useAddLicenseTypePackage: () => refuse, usePublishLicenseType: () => refuse,
    useRetireLicenseType: guard,
  }
})

import { TiersTab } from '../components/tiers-tab'
import { HoldersTab } from '../components/holders-tab'
import { EnvironmentsTab } from '../components/environments-tab'

beforeEach(() => {
  cleanup()
  toastError.mockReset()
  retire.mockReset()
  writeHooksExplode = false
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

  it('holders: a refused revoke shows the refusal and every holder stays listed', async () => {
    render(<HoldersTab appId="a1" />)
    fireEvent.click(screen.getAllByRole('button', { name: /^revoke$/i })[0])
    fireEvent.click(await screen.findByRole('button', { name: /revoke licence/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(refusal))
    expect(retire).toHaveBeenCalled()
    // The open dialog repeats the address, so assert on the table's own cells.
    const table = within(screen.getByRole('table', { hidden: true }))
    expect(table.getByText('0x1111111111111111111111111111111111111111')).toBeTruthy()
    expect(table.getByText('0x2222222222222222222222222222222222222222')).toBeTruthy()
  })

  it('environments: rows render and no write hook is needed', () => {
    writeHooksExplode = true
    render(<EnvironmentsTab appId="a1" />)
    expect(screen.getByText('env-one')).toBeTruthy()
    expect(screen.getByText('env-two')).toBeTruthy()
  })
})
