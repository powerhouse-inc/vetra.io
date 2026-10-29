import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(m: string) => void>(),
  toastSuccess: vi.fn<(m: string) => void>(),
}))
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

import { ConfigHistorySection } from '@/modules/cloud/components/config-history-section'
import type { HistoryOperation, RestoreActions } from '@/modules/cloud/lib/config-history'
import type { CloudEnvironmentState } from '@/modules/cloud/types'

const OWNER = '0x00000000000000000000000000000000000000aa'

const op = (index: number, type: string, input: unknown = {}): HistoryOperation => ({
  index,
  timestampUtcMs: String(Date.now() - (100 - index) * 60_000),
  action: { type, input, context: { signer: { user: { address: OWNER } } } },
})

// v1: switchboard + @acme/base; then @acme/crm added and approved (v2)
const operations: HistoryOperation[] = [
  op(1, 'ENABLE_SERVICE', { type: 'SWITCHBOARD', prefix: 'switchboard' }),
  op(2, 'ADD_PACKAGE', { packageName: '@acme/base', version: '1.0.0' }),
  op(3, 'APPROVE_CHANGES'),
  op(4, 'ADD_PACKAGE', { packageName: '@acme/crm', version: '2.0.0' }),
  op(5, 'APPROVE_CHANGES'),
]

const current = {
  owner: OWNER,
  label: null,
  genericSubdomain: null,
  genericBaseDomain: null,
  customDomain: null,
  defaultPackageRegistry: null,
  status: 'READY',
  apexService: null,
  services: [
    {
      type: 'SWITCHBOARD',
      prefix: 'switchboard',
      enabled: true,
      url: null,
      status: 'ACTIVE',
      version: null,
      config: null,
      selectedRessource: 'VETRA_AGENT_S',
    },
  ],
  packages: [
    { registry: '', name: '@acme/base', version: '1.0.0' },
    { registry: '', name: '@acme/crm', version: '2.0.0' },
  ],
} as unknown as CloudEnvironmentState

/** Detail-hook methods, mocked. */
function mockActions() {
  const ok = () => vi.fn(() => Promise.resolve())
  return {
    setLabel: ok(),
    setGenericSubdomain: ok(),
    enableService: ok(),
    disableService: ok(),
    setServiceSize: ok(),
    setServiceConfig: ok(),
    addPackage: ok(),
    removePackage: ok(),
    setPackageVersion: ok(),
    setCustomDomain: ok(),
    approveChanges: vi.fn(() => Promise.resolve()),
  } satisfies RestoreActions & { approveChanges: () => Promise<void> }
}

const click = (el: HTMLElement) =>
  act(async () => {
    fireEvent.click(el)
    await Promise.resolve()
  })

describe('ConfigHistorySection', () => {
  beforeEach(() => {
    cleanup()
    toastError.mockReset()
    toastSuccess.mockReset()
  })

  it('lists approvals, marks the current one and restores an older one after confirming', async () => {
    const actions = mockActions()
    render(
      <ConfigHistorySection
        operations={operations}
        current={current}
        actions={actions}
        canEdit
        viewerAddress={OWNER}
      />,
    )
    expect(screen.getByText('Current')).toBeTruthy()
    expect(screen.getByText('Add @acme/crm 2.0.0')).toBeTruthy()
    expect(screen.getAllByText('you')).toHaveLength(2)

    const restoreButtons = screen.getAllByRole('button', { name: 'Restore this configuration' })
    expect(restoreButtons).toHaveLength(1)
    await click(restoreButtons[0])

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/Variables and secrets are not restored/)).toBeTruthy()
    const plan = within(dialog).getByRole('list', { name: 'Changes to make' })
    expect(
      within(plan)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Remove @acme/crm'])
    expect(actions.removePackage).not.toHaveBeenCalled()

    await click(within(dialog).getByRole('button', { name: 'Restore' }))
    expect(actions.removePackage).toHaveBeenCalledWith('@acme/crm')
    // never approves on its own
    expect(actions.approveChanges).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('cancel dispatches nothing', async () => {
    const actions = mockActions()
    render(
      <ConfigHistorySection operations={operations} current={current} actions={actions} canEdit />,
    )
    await click(screen.getByRole('button', { name: 'Restore this configuration' }))
    await click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(actions.removePackage).not.toHaveBeenCalled()
  })

  it('keeps the dialog open and reports a failed restore', async () => {
    const actions = mockActions()
    actions.removePackage.mockImplementation(() => Promise.reject(new Error('boom')))
    render(
      <ConfigHistorySection operations={operations} current={current} actions={actions} canEdit />,
    )
    await click(screen.getByRole('button', { name: 'Restore this configuration' }))
    await click(screen.getByRole('button', { name: 'Restore' }))
    expect(toastError).toHaveBeenCalledOnce()
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('hides restore from viewers who cannot edit', () => {
    render(
      <ConfigHistorySection
        operations={operations}
        current={current}
        actions={mockActions()}
        canEdit={false}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Restore this configuration' })).toBeNull()
    expect(screen.getByText('Current')).toBeTruthy()
  })

  it('asks signed-out viewers to log in', () => {
    render(
      <ConfigHistorySection
        operations={null}
        current={current}
        actions={mockActions()}
        canEdit={false}
      />,
    )
    expect(screen.getByText('Log in to see past configurations.')).toBeTruthy()
  })
})
