import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { PublisherTemplate } from '../types'

const setDetails = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useSetTemplateDetails: () => ({ mutateAsync: setDetails, isPending: false }),
}))
vi.mock('../hooks/use-publisher', () => ({
  usePublisherAppArtifacts: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/modules/cloud/hooks/use-environment', () => ({
  useViewer: () => ({ viewer: { address: '0xme', isAdmin: false }, isLoading: false }),
  useEnvironments: () => ({
    environments: [{ id: 'env-9', name: 'Community', state: { label: 'Community' } }],
    isPending: false,
    isError: false,
  }),
}))
vi.mock('@/modules/shared/components/ui/select', () => import('@/modules/shared/test/native-select'))
// Contents have their own tests; this one is about the details guard.
vi.mock('../components/templates/template-contents', () => ({ TemplateContents: () => null }))

import { TemplateEditor } from '../components/templates/template-editor'

const tpl = (over: Partial<PublisherTemplate> = {}): PublisherTemplate => ({
  id: 'tpl-1', name: 'Pro', mode: 'DEDICATED', sharedEnvironment: null, size: null, baseDomain: null,
  packageRegistry: null, services: [], packages: [], templateHash: 'h', environmentCount: 3, ...over,
})

describe('TemplateEditor', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('asks before saving a template that environments run on, and Keep editing sends nothing', async () => {
    setDetails.mockResolvedValue(true)
    render(<TemplateEditor appId="app-1" template={tpl()} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'VETRA_AGENT_L' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(setDetails).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Keep editing' })))
    expect(setDetails).not.toHaveBeenCalled()
  })

  it('sends the change once the publisher confirms', async () => {
    setDetails.mockResolvedValue(true)
    render(<TemplateEditor appId="app-1" template={tpl()} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'VETRA_AGENT_L' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Apply to 3 environments' })))
    expect(setDetails).toHaveBeenCalledOnce()
  })

  it('names the chosen shared environment', () => {
    render(
      <TemplateEditor
        appId="app-1"
        template={tpl({ mode: 'SHARED', sharedEnvironment: 'env-9', environmentCount: 0 })}
        open
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('template-summary').textContent).toBe(
      'Owners get an account on the Community environment.',
    )
  })

  it('offers a fallback item for a saved environment missing from the list', () => {
    render(
      <TemplateEditor
        appId="app-1"
        template={tpl({ mode: 'SHARED', sharedEnvironment: 'env-gone', environmentCount: 0 })}
        open
        onClose={vi.fn()}
      />,
    )
    expect((screen.getByLabelText('Shared environment') as HTMLSelectElement).value).toBe('env-gone')
  })

  it('shows a short error with Close when the template is missing', () => {
    const onClose = vi.fn()
    render(<TemplateEditor appId="app-1" template={null} missing open onClose={onClose} />)
    expect(screen.getByText(/no longer here/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to templates' }))
    expect(onClose).toHaveBeenCalled()
  })
})
