import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EnvActionBar } from '@/modules/cloud/components/env-action-bar'
import type { PendingChange } from '@/modules/cloud/lib/pending-changes'

const changes: PendingChange[] = [
  { key: 'package:@acme/crm', kind: 'add', label: 'Install @acme/crm 0.9.1' },
  { key: 'label', kind: 'change', label: 'Rename to “acme-prod”' },
]

const bar = (pendingChanges?: PendingChange[]) =>
  render(
    <EnvActionBar
      status="CHANGES_PENDING"
      intentDeploying={false}
      driftDetected={false}
      pendingChanges={pendingChanges}
      onApprove={vi.fn()}
    />,
  )

describe('EnvActionBar pending changes', () => {
  it('counts the pending changes and lists them on click', () => {
    bar(changes)
    fireEvent.click(screen.getByRole('button', { name: '2 pending changes' }))
    expect(screen.getByText('Approve deploys these changes')).toBeTruthy()
    expect(screen.getByText('Install @acme/crm 0.9.1')).toBeTruthy()
    expect(screen.getByText('Rename to “acme-prod”')).toBeTruthy()
  })

  it('keeps the plain wording while the change list is unknown', () => {
    bar()
    expect(screen.getByText('Pending change')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Approve pending changes' })).toBeTruthy()
  })
})
