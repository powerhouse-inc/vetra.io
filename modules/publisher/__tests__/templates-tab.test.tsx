import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import type { PublisherTemplate, PublisherTerm } from '../types'

let templates: { data?: PublisherTemplate[]; isPending: boolean; isFetching?: boolean; error: Error | null }
let terms: PublisherTerm[] = []
let termsState: { isPending: boolean; error: Error | null } = { isPending: false, error: null }
const addTemplate = vi.fn()
const deleteTemplate = vi.fn()

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher', () => ({
  usePublisherTemplates: () => ({ ...templates, refetch: vi.fn(), isRefetching: false }),
  usePublisherTerms: () => ({ data: terms, ...termsState }),
}))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useAddTemplate: () => ({ mutateAsync: addTemplate, isPending: false }),
  useDeleteTemplate: () => ({ mutateAsync: deleteTemplate, isPending: false }),
}))
// The editor has its own tests; here it only needs to say which template is open.
vi.mock('../components/templates/template-editor', () => ({
  TemplateEditor: ({ open, template, missing }: { open: boolean; template: PublisherTemplate | null; missing?: boolean }) =>
    open ? <div data-testid="editor">{template ? template.id : missing ? 'missing' : 'loading'}</div> : null,
}))

import { TemplatesTab } from '../components/templates/templates-tab'

const tpl = (over: Partial<PublisherTemplate>): PublisherTemplate => ({
  id: 'tpl-1', name: 'Pro', mode: 'DEDICATED', sharedEnvironment: null, size: null, baseDomain: null,
  packageRegistry: null, services: [], packages: [], templateHash: 'h', environmentCount: 0, ...over,
})
const term = (over: Partial<PublisherTerm>): PublisherTerm => ({
  id: 'term-1', kind: '2026-pro', label: 'Pro', templateId: 'tpl-1', validityDays: null,
  issuers: ['PUBLISHER_GRANT'], status: 'ACTIVE', activeLicenses: 0, ...over,
})

describe('TemplatesTab', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    terms = []
    termsState = { isPending: false, error: null }
  })

  it('invites a first template when there are none', () => {
    templates = { data: [], isPending: false, error: null }
    render(<TemplatesTab appId="app-1" />)
    expect(screen.getByText('No templates yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create your first template' })).toBeTruthy()
  })

  it('shows mode, plan usage and environment count per template', () => {
    templates = {
      data: [tpl({ id: 'tpl-1', environmentCount: 3 }), tpl({ id: 'tpl-2', name: 'Free', mode: 'SHARED' })],
      isPending: false,
      error: null,
    }
    terms = [term({ templateId: 'tpl-1' })]
    render(<TemplatesTab appId="app-1" />)
    const pro = screen.getByTestId('template-tpl-1')
    expect(within(pro).getByText('Dedicated')).toBeTruthy()
    expect(within(pro).getByText('Used by Pro')).toBeTruthy()
    expect(within(pro).getByText('3 environments')).toBeTruthy()
    const free = screen.getByTestId('template-tpl-2')
    expect(within(free).getByText('Shared')).toBeTruthy()
    expect(within(free).getByText('Not used by a plan yet')).toBeTruthy()
  })

  it('cannot delete a template a plan still uses', () => {
    templates = { data: [tpl({})], isPending: false, error: null }
    terms = [term({})]
    render(<TemplatesTab appId="app-1" />)
    expect((screen.getByRole('button', { name: 'Delete Pro' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('creates a template and opens it in the editor', async () => {
    templates = { data: [tpl({ id: 'tpl-0' })], isPending: false, isFetching: true, error: null }
    addTemplate.mockResolvedValue('tpl-new')
    render(<TemplatesTab appId="app-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Starter' } })
    fireEvent.click(screen.getByRole('radio', { name: /dedicated/i }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create template' })))
    expect(addTemplate).toHaveBeenCalledWith({ name: 'Starter', mode: 'DEDICATED' })
    expect(screen.getByTestId('editor').textContent).toBe('loading')
  })

  it('does not call a template unused, or let it be deleted, while plans are loading', () => {
    templates = { data: [tpl({})], isPending: false, error: null }
    termsState = { isPending: true, error: null }
    render(<TemplatesTab appId="app-1" />)
    expect(screen.queryByText('Not used by a plan yet')).toBeNull()
    expect(screen.getByText('Checking plans…')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Delete Pro' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps Delete disabled when plans failed to load', () => {
    templates = { data: [tpl({})], isPending: false, error: null }
    termsState = { isPending: false, error: new Error('x') }
    render(<TemplatesTab appId="app-1" />)
    expect(screen.queryByText('Not used by a plan yet')).toBeNull()
    expect((screen.getByRole('button', { name: 'Delete Pro' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('cannot delete a template that environments still run on', () => {
    templates = { data: [tpl({ environmentCount: 2 })], isPending: false, error: null }
    render(<TemplatesTab appId="app-1" />)
    expect((screen.getByRole('button', { name: 'Delete Pro' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('says so when the template being edited is not in the loaded list', async () => {
    templates = { data: [tpl({ id: 'tpl-0' })], isPending: false, error: null }
    addTemplate.mockResolvedValue('tpl-gone')
    render(<TemplatesTab appId="app-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('radio', { name: /dedicated/i }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create template' })))
    expect(screen.getByTestId('editor').textContent).toBe('missing')
  })
})
