import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { PublisherAppArtifact, PublisherTemplate } from '../types'

const addPackage = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useAddTemplatePackage: () => ({ mutateAsync: addPackage, isPending: false }),
  useRemoveTemplatePackage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/modules/shared/components/ui/select', () => import('@/modules/shared/test/native-select'))

import { TemplatePackages } from '../components/templates/template-packages'

const tpl: PublisherTemplate = {
  id: 'tpl-1', name: 'Pro', mode: 'DEDICATED', sharedEnvironment: null, size: null, baseDomain: null,
  packageRegistry: null, services: [], packages: [], templateHash: 'h', environmentCount: 0,
}
const pkg: PublisherAppArtifact = {
  kind: 'PACKAGE', name: '@acme/vault',
  versions: [{ version: '1.0.0', reference: 'a' }, { version: '1.1.0', reference: 'b' }], channels: [],
}

describe('TemplatePackages', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('offers versions newest first and sends the pick', async () => {
    addPackage.mockResolvedValue(true)
    render(<TemplatePackages appId="app-1" template={tpl} guard={(_, run) => void run()} artifacts={[pkg]} artifactsLoading={false} />)
    fireEvent.change(screen.getByLabelText('Package'), { target: { value: '@acme/vault' } })
    const versions = Array.from((screen.getByLabelText('Version') as HTMLSelectElement).options).map((o) => o.value)
    expect(versions).toEqual(['', '1.1.0', '1.0.0'])
    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.0.0' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add package' })))
    expect(addPackage).toHaveBeenCalledWith({ templateId: 'tpl-1', packageName: '@acme/vault', version: '1.0.0' })
  })

  it('sends no version for "latest"', async () => {
    addPackage.mockResolvedValue(true)
    render(<TemplatePackages appId="app-1" template={tpl} guard={(_, run) => void run()} artifacts={[pkg]} artifactsLoading={false} />)
    fireEvent.change(screen.getByLabelText('Package'), { target: { value: '@acme/vault' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add package' })))
    expect(addPackage).toHaveBeenCalledWith({ templateId: 'tpl-1', packageName: '@acme/vault', version: null })
  })
})
