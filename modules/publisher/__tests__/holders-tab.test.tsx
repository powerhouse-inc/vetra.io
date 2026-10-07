import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import React from 'react'

const issueGrant = vi.fn()
const revoke = vi.fn()
const toastError = vi.fn()
const toastSuccess = vi.fn()
const licenseQueries: Array<string | null> = []
let licenses: Array<Record<string, unknown>> = []
let tiers: unknown[] = []

vi.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}))
vi.mock('../hooks/use-publisher', () => ({
  // Honours the status argument like the real query, so a filter genuinely hides rows.
  usePublisherLicenses: (_appId: string, status: string | null) => {
    licenseQueries.push(status)
    return { data: status ? licenses.filter((l) => l.status === status) : licenses, isPending: false, error: null }
  },
  usePublisherLicenseTypes: () => ({ data: tiers, isPending: false }),
}))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useIssueGrant: () => ({ mutateAsync: issueGrant, isPending: false }),
  useRevokeLicense: () => ({ mutateAsync: revoke, isPending: false }),
}))
vi.mock('@/shared/components/ui/select', () => {
  const Trigger = (_: { 'aria-label'?: string }) => null
  return {
    // Native stand-in: Radix Select is not drivable in jsdom. Takes its label from the trigger.
    Select: ({ value, onValueChange, children }: { value?: string; onValueChange: (v: string) => void; children: React.ReactNode }) => {
      // The trigger may be wrapped (FormControl), so search the tree for it.
      const find = (n: React.ReactNode): string | undefined => {
        for (const c of React.Children.toArray(n)) {
          if (!React.isValidElement(c)) continue
          const el = c as React.ReactElement<{ 'aria-label'?: string; children?: React.ReactNode }>
          if (el.type === Trigger) return el.props['aria-label']
          const inner = find(el.props.children)
          if (inner) return inner
        }
      }
      const trigger = { props: { 'aria-label': find(children) } }
      return (
        <select aria-label={trigger?.props['aria-label']} value={value ?? ''} onChange={(e) => onValueChange(e.target.value)}>
          <option value="" />
          {children}
        </select>
      )
    },
    SelectTrigger: Trigger,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
  }
})

import { HoldersTab } from '../components/holders-tab'

const HOLDER = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'
const OTHER = '0x1111111111111111111111111111111111111111'

const lic = (over: Record<string, unknown> = {}) => ({
  id: 'lic-1', user: HOLDER.toLowerCase(), licenseTypeId: 'lt-1', status: 'ACTIVE',
  start: null, end: null, environmentId: 'env-1', ...over,
})
const tier = (over: Record<string, unknown> = {}) => ({
  id: 'lt-1', label: 'Pro', kind: 'PRO', status: 'ACTIVE', validityDays: 365, templateHash: 'h', services: [], packages: [], ...over,
})

beforeEach(() => {
  cleanup()
  licenses = []
  tiers = [tier()]
  licenseQueries.length = 0
  for (const m of [issueGrant, revoke, toastError, toastSuccess]) m.mockReset()
})

const openGrant = () => fireEvent.click(screen.getByRole('button', { name: /grant/i }))
const typeAddress = (v: string) => fireEvent.change(screen.getByLabelText(/address/i), { target: { value: v } })
const WARNING = /already holds an active or pending licence/i

describe('HoldersTab', () => {
  it('warns before granting a SECOND licence to an address that already holds one', async () => {
    licenses = [lic()]
    render(<HoldersTab appId="a1" />)
    openGrant()
    typeAddress(HOLDER)
    expect(await screen.findByText(WARNING)).toBeTruthy()
    expect(screen.getByText(/which one applies is not deterministic/i)).toBeTruthy()
  })

  it('matches the existing holder case-insensitively', async () => {
    licenses = [lic()]
    render(<HoldersTab appId="a1" />)
    openGrant()
    typeAddress(HOLDER.toUpperCase().replace('0X', '0x'))
    expect(await screen.findByText(WARNING)).toBeTruthy()
  })

  it('matches when the server copy is checksummed and the typed one is lowercase', async () => {
    licenses = [lic({ user: HOLDER })]
    render(<HoldersTab appId="a1" />)
    openGrant()
    typeAddress(HOLDER.toLowerCase())
    expect(await screen.findByText(WARNING)).toBeTruthy()
  })

  it('ignores surrounding whitespace when matching', async () => {
    licenses = [lic()]
    render(<HoldersTab appId="a1" />)
    openGrant()
    typeAddress(`  ${HOLDER}  `)
    expect(await screen.findByText(WARNING)).toBeTruthy()
  })

  it('finds the duplicate among several licences, not just the first', async () => {
    licenses = [lic({ id: 'a', user: OTHER }), lic({ id: 'b', user: HOLDER.toLowerCase() })]
    render(<HoldersTab appId="a1" />)
    openGrant()
    typeAddress(HOLDER)
    expect(await screen.findByText(WARNING)).toBeTruthy()
  })

  it('warns for an address whose licence is still ISSUED (keeper has not activated it yet)', async () => {
    licenses = [lic({ status: 'ISSUED', environmentId: null })]
    render(<HoldersTab appId="a1" />)
    openGrant()
    typeAddress(HOLDER)
    expect(await screen.findByText(WARNING)).toBeTruthy()
    expect(screen.getByText(/not deterministic/i)).toBeTruthy()
  })

  it('does NOT warn for an address holding only a revoked licence', async () => {
    licenses = [lic({ status: 'REVOKED' })]
    render(<HoldersTab appId="a1" />)
    openGrant()
    typeAddress(HOLDER)
    await waitFor(() => expect((screen.getByLabelText(/address/i) as HTMLInputElement).value).toBe(HOLDER))
    expect(screen.queryByText(WARNING)).toBeNull()
  })

  it('does NOT warn for a different address, or before anything is typed', async () => {
    licenses = [lic()]
    render(<HoldersTab appId="a1" />)
    openGrant()
    expect(screen.queryByText(WARNING)).toBeNull()
    typeAddress(OTHER)
    await waitFor(() => expect((screen.getByLabelText(/address/i) as HTMLInputElement).value).toBe(OTHER))
    expect(screen.queryByText(WARNING)).toBeNull()
  })

  it('still warns when the status filter hides the existing ACTIVE licence', async () => {
    // The duplicate check must read the unfiltered list, not the rows on screen.
    licenses = [lic(), lic({ id: 'lic-2', user: OTHER, status: 'REVOKED' })]
    render(<HoldersTab appId="a1" />)
    fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'REVOKED' } })
    expect(screen.queryByText(HOLDER.toLowerCase())).toBeNull() // really hidden
    openGrant()
    typeAddress(HOLDER)
    expect(await screen.findByText(WARNING)).toBeTruthy()
  })

  it('the status filter queries the server with that status', () => {
    render(<HoldersTab appId="a1" />)
    fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'EXPIRED' } })
    expect(licenseQueries).toContain('EXPIRED')
  })

  it('grants exactly the address and tier the publisher chose', async () => {
    tiers = [tier({ id: 'lt-1', label: 'Pro' }), tier({ id: 'lt-2', label: 'Team', kind: 'TEAM' })]
    issueGrant.mockResolvedValue('new-id')
    render(<HoldersTab appId="a1" />)
    openGrant()
    typeAddress(`  ${HOLDER}  `)
    fireEvent.change(screen.getByLabelText('Tier'), { target: { value: 'lt-2' } })
    fireEvent.click(screen.getAllByRole('button', { name: /grant licence/i }).at(-1)!)
    await waitFor(() => expect(issueGrant).toHaveBeenCalledTimes(1))
    expect(issueGrant).toHaveBeenCalledWith({ appId: 'a1', licenseTypeId: 'lt-2', user: HOLDER })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
  })

  it('offers only published (ACTIVE) tiers', () => {
    tiers = [tier({ id: 'lt-1', label: 'Live' }), tier({ id: 'lt-2', label: 'Drafty', status: 'DRAFT' }), tier({ id: 'lt-3', label: 'Gone', status: 'RETIRED' })]
    render(<HoldersTab appId="a1" />)
    openGrant()
    const tier_ = screen.getByLabelText('Tier')
    expect(within(tier_).queryByText('Live')).toBeTruthy()
    expect(within(tier_).queryByText('Drafty')).toBeNull()
    expect(within(tier_).queryByText('Gone')).toBeNull()
  })

  it('does not call the server for a malformed address or a missing tier', async () => {
    render(<HoldersTab appId="a1" />)
    openGrant()
    typeAddress('0x123')
    fireEvent.change(screen.getByLabelText('Tier'), { target: { value: 'lt-1' } })
    fireEvent.click(screen.getAllByRole('button', { name: /grant licence/i }).at(-1)!)
    expect(await screen.findByText(/0x wallet address/i)).toBeTruthy()
    typeAddress(HOLDER)
    fireEvent.change(screen.getByLabelText('Tier'), { target: { value: '' } })
    fireEvent.click(screen.getAllByRole('button', { name: /grant licence/i }).at(-1)!)
    expect(await screen.findByText(/choose a tier/i)).toBeTruthy()
    expect(issueGrant).not.toHaveBeenCalled()
  })

  it('shows the server sentence verbatim when a grant is refused', async () => {
    issueGrant.mockRejectedValue(new Error('licensing is disabled on this deployment'))
    render(<HoldersTab appId="a1" />)
    openGrant()
    typeAddress(HOLDER)
    fireEvent.change(screen.getByLabelText('Tier'), { target: { value: 'lt-1' } })
    fireEvent.click(screen.getAllByRole('button', { name: /grant licence/i }).at(-1)!)
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('licensing is disabled on this deployment'))
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('revoking asks for confirmation before calling the server', () => {
    licenses = [lic()]
    render(<HoldersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /revoke/i }))
    expect(revoke).not.toHaveBeenCalled()
    expect(screen.getByText(/release their environment/i)).toBeTruthy()
  })

  it('cancelling the revoke confirmation never calls the server', () => {
    licenses = [lic()]
    render(<HoldersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /revoke/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(revoke).not.toHaveBeenCalled()
  })

  it('confirming revokes the clicked row (not another) and sends the reason', async () => {
    revoke.mockResolvedValue(true)
    licenses = [lic({ id: 'lic-A', user: OTHER }), lic({ id: 'lic-B' })]
    render(<HoldersTab appId="a1" />)
    const row = screen.getByText(HOLDER.toLowerCase()).closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: /revoke/i }))
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: ' stopped paying ' } })
    fireEvent.click(screen.getByRole('button', { name: /revoke licence/i }))
    await waitFor(() => expect(revoke).toHaveBeenCalledTimes(1))
    expect(revoke).toHaveBeenCalledWith({ licenseId: 'lic-B', reason: 'stopped paying' })
  })

  it('sends a null reason when none is given', async () => {
    revoke.mockResolvedValue(true)
    licenses = [lic()]
    render(<HoldersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /revoke/i }))
    fireEvent.click(screen.getByRole('button', { name: /revoke licence/i }))
    await waitFor(() => expect(revoke).toHaveBeenCalledWith({ licenseId: 'lic-1', reason: null }))
  })

  it('shows the server sentence verbatim when a revoke is refused', async () => {
    revoke.mockRejectedValue(new Error('licence already revoked'))
    licenses = [lic()]
    render(<HoldersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /revoke/i }))
    fireEvent.click(screen.getByRole('button', { name: /revoke licence/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('licence already revoked'))
  })

  it('offers Revoke only on ACTIVE and ISSUED rows, across several rows', () => {
    licenses = [
      lic({ id: '1', user: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', status: 'ACTIVE' }),
      lic({ id: '2', user: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', status: 'ISSUED' }),
      lic({ id: '3', user: '0xcccccccccccccccccccccccccccccccccccccccc', status: 'REVOKED' }),
      lic({ id: '4', user: '0xdddddddddddddddddddddddddddddddddddddddd', status: 'EXPIRED' }),
    ]
    render(<HoldersTab appId="a1" />)
    const has = (u: string) =>
      !!within(screen.getByText(u).closest('tr') as HTMLElement).queryByRole('button', { name: /revoke/i })
    expect(has('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true)
    expect(has('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toBe(true)
    expect(has('0xcccccccccccccccccccccccccccccccccccccccc')).toBe(false)
    expect(has('0xdddddddddddddddddddddddddddddddddddddddd')).toBe(false)
  })

  it('shows the tier label, status and environment for each holder', () => {
    licenses = [lic({ environmentId: 'env-xyz' })]
    render(<HoldersTab appId="a1" />)
    const row = screen.getByText(HOLDER.toLowerCase()).closest('tr') as HTMLElement
    expect(within(row).getByText('Pro')).toBeTruthy()
    expect(within(row).getByText('Active')).toBeTruthy()
    expect(within(row).getByText('env-xyz')).toBeTruthy()
  })

  it('renders an empty state when nobody holds a licence', () => {
    render(<HoldersTab appId="a1" />)
    expect(screen.getByText(/no licences/i)).toBeTruthy()
  })
})
