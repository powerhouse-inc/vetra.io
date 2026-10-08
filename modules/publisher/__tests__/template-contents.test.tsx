import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { PublisherTemplate } from '../types'

const addService = vi.fn()
const refetch = vi.fn()
let artifacts: { data?: unknown[]; error: Error | null; isLoading: boolean }
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher', () => ({
  usePublisherAppArtifacts: () => ({ ...artifacts, refetch }),
}))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useAddTemplateService: () => ({ mutateAsync: addService, isPending: false }),
  useRemoveTemplateService: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddTemplatePackage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveTemplatePackage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/modules/shared/components/ui/select', () => import('@/modules/shared/test/native-select'))

import { useAffectsConfirm } from '../components/templates/affects-confirm'
import { TemplateContents } from '../components/templates/template-contents'

const tpl: PublisherTemplate = {
  id: 'tpl-1', name: 'Pro', mode: 'DEDICATED', sharedEnvironment: null, size: null, baseDomain: null,
  packageRegistry: null, services: [], packages: [], templateHash: 'h', environmentCount: 2,
}

function Harness() {
  const { guard, dialog } = useAffectsConfirm(tpl.environmentCount)
  return (
    <>
      <TemplateContents appId="app-1" template={tpl} guard={guard} />
      {dialog}
    </>
  )
}

describe('TemplateContents', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    artifacts = { data: [], error: null, isLoading: false }
  })

  it('asks before adding a service to a template environments run on', async () => {
    addService.mockResolvedValue(true)
    render(<Harness />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add service' })))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(addService).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Apply to 2 environments' })))
    expect(addService).toHaveBeenCalledOnce()
  })

  it('offers a retry when the published artifacts failed to load', () => {
    artifacts = { error: new Error('x'), isLoading: false }
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Service type'), { target: { value: 'FUSION' } })
    expect(screen.getAllByText(/could not load your published/i).length).toBe(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0])
    expect(refetch).toHaveBeenCalledOnce()
  })
})
