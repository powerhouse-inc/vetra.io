import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/modules/cloud/graphql', () => ({
  fetchLatestRelease: vi.fn().mockResolvedValue(null),
  fetchEnvironmentReleaseHistory: vi.fn().mockResolvedValue([
    {
      documentId: 'env-1',
      tenantId: null,
      service: 'CONNECT',
      fromTag: 'v1.0.0',
      toTag: 'v1.1.0',
      trigger: 'AUTO',
      channel: 'LATEST',
      at: '2026-10-01T00:00:00Z',
      releaseUrl: null,
    },
  ]),
}))

import { AutoUpdateCard } from '@/modules/cloud/components/auto-update-card'
import type { CloudEnvironment } from '@/modules/cloud/types'

const environment = {
  id: 'env-1',
  state: {
    autoUpdateChannel: 'LATEST',
    services: [{ type: 'CONNECT', prefix: 'connect', enabled: true, version: 'v1.1.0' }],
  },
} as unknown as CloudEnvironment

describe('AutoUpdateCard rollback', () => {
  beforeEach(() => cleanup())

  it('asks for confirmation before rolling back', async () => {
    const onRollback = vi.fn().mockResolvedValue(['CONNECT'])
    await act(async () => {
      render(
        <AutoUpdateCard
          environment={environment}
          onChangeChannel={vi.fn()}
          onUpdateNow={vi.fn()}
          onRollback={onRollback}
        />,
      )
    })
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Roll back' })))
    expect(onRollback).not.toHaveBeenCalled()
    expect(screen.getByText('Roll back to the previous version?')).toBeTruthy()
    expect(screen.getByText('Connect: v1.1.0 → v1.0.0')).toBeTruthy()

    const confirm = screen
      .getAllByRole('button', { name: 'Roll back' })
      .find((b) => b.closest('[role="alertdialog"]'))!
    await act(async () => fireEvent.click(confirm))
    expect(onRollback).toHaveBeenCalledOnce()
  })
})
