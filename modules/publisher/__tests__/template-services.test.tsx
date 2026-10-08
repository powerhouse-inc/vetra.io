import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { PublisherAppArtifact, PublisherTemplate } from '../types'

const addService = vi.fn()
const removeService = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useAddTemplateService: () => ({ mutateAsync: addService, isPending: false }),
  useRemoveTemplateService: () => ({ mutateAsync: removeService, isPending: false }),
}))
vi.mock('@/modules/shared/components/ui/select', () => import('@/modules/shared/test/native-select'))

import { TemplateServices } from '../components/templates/template-services'

const tpl = (over: Partial<PublisherTemplate> = {}): PublisherTemplate => ({
  id: 'tpl-1', name: 'Pro', mode: 'DEDICATED', sharedEnvironment: null, size: null, baseDomain: null,
  packageRegistry: null, services: [], packages: [], templateHash: 'h', environmentCount: 2, ...over,
})
const image: PublisherAppArtifact = {
  kind: 'FUSION_IMAGE', name: 'vault-app', versions: [{ version: '1.0.0', reference: 'sha' }], channels: [],
}

describe('TemplateServices', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('adds an app-image service following a channel, through the guard', async () => {
    addService.mockResolvedValue(true)
    const guard = vi.fn((_: string, run: () => Promise<unknown>) => void run())
    render(<TemplateServices appId="app-1" template={tpl()} guard={guard} artifacts={[image]} artifactsLoading={false} />)
    fireEvent.change(screen.getByLabelText('Service type'), { target: { value: 'FUSION' } })
    fireEvent.change(screen.getByLabelText('Image'), { target: { value: 'vault-app' } })
    fireEvent.change(screen.getByLabelText('Follows'), { target: { value: 'STAGING' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add service' })))
    expect(guard).toHaveBeenCalledWith('Add this service?', expect.any(Function))
    expect(addService).toHaveBeenCalledWith({
      templateId: 'tpl-1', type: 'FUSION', prefix: 'vault-app', artifactName: 'vault-app', artifactChannel: 'STAGING',
    })
  })

  it('does not write when the guard holds the change back', async () => {
    const guard = vi.fn()
    render(<TemplateServices appId="app-1" template={tpl()} guard={guard} artifacts={[image]} artifactsLoading={false} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add service' })))
    expect(guard).toHaveBeenCalledOnce()
    expect(addService).not.toHaveBeenCalled()
  })

  it('explains a missing image instead of showing an empty picker', () => {
    render(<TemplateServices appId="app-1" template={tpl()} guard={vi.fn()} artifacts={[]} artifactsLoading={false} />)
    fireEvent.change(screen.getByLabelText('Service type'), { target: { value: 'FUSION' } })
    expect(screen.getByText(/has not published an app image yet/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Add service' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('removes a service through the guard', async () => {
    removeService.mockResolvedValue(true)
    const t = tpl({ services: [{ id: 's1', type: 'CONNECT', prefix: null, artifactName: null, artifactChannel: null }] })
    render(<TemplateServices appId="app-1" template={t} guard={(_, run) => void run()} artifacts={[]} artifactsLoading={false} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove Connect service' })))
    expect(removeService).toHaveBeenCalledWith({ templateId: 'tpl-1', id: 's1' })
  })

  it('keeps Add disabled for an app image until one is chosen', () => {
    render(<TemplateServices appId="app-1" template={tpl()} guard={vi.fn()} artifacts={[image]} artifactsLoading={false} />)
    fireEvent.change(screen.getByLabelText('Service type'), { target: { value: 'FUSION' } })
    expect((screen.getByRole('button', { name: 'Add service' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('follows a second image pick while the prefix is still the autofilled one', () => {
    const other: PublisherAppArtifact = { ...image, name: 'other-app' }
    render(<TemplateServices appId="app-1" template={tpl()} guard={vi.fn()} artifacts={[image, other]} artifactsLoading={false} />)
    fireEvent.change(screen.getByLabelText('Service type'), { target: { value: 'FUSION' } })
    fireEvent.change(screen.getByLabelText('Image'), { target: { value: 'vault-app' } })
    fireEvent.change(screen.getByLabelText('Image'), { target: { value: 'other-app' } })
    expect((screen.getByLabelText('Subdomain prefix (optional)') as HTMLInputElement).value).toBe('other-app')
    fireEvent.change(screen.getByLabelText('Subdomain prefix (optional)'), { target: { value: 'mine' } })
    fireEvent.change(screen.getByLabelText('Image'), { target: { value: 'vault-app' } })
    expect((screen.getByLabelText('Subdomain prefix (optional)') as HTMLInputElement).value).toBe('mine')
  })

  it('offers a retry instead of "no image yet" when artifacts failed to load', () => {
    const retry = vi.fn()
    render(<TemplateServices appId="app-1" template={tpl()} guard={vi.fn()} artifacts={[]} artifactsLoading={false} artifactsFailed onRetryArtifacts={retry} />)
    fireEvent.change(screen.getByLabelText('Service type'), { target: { value: 'FUSION' } })
    expect(screen.getByText(/could not load your published images/i)).toBeTruthy()
    expect(screen.queryByText(/has not published an app image yet/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
