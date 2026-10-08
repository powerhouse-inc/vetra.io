import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { PublisherTemplate, PublisherTerm } from '../types'

const addTerm = vi.fn()
const setTerm = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useAddTerm: () => ({ mutateAsync: addTerm, isPending: false }),
  useSetTermDetails: () => ({ mutateAsync: setTerm, isPending: false }),
}))
vi.mock(
  '@/modules/shared/components/ui/select',
  () => import('@/modules/shared/test/native-select'),
)

import { PlanDialog } from '../components/plans/plan-dialog'

const templates = [{ id: 'tpl-1', name: 'Workspace', mode: 'DEDICATED' } as PublisherTemplate]

describe('PlanDialog', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('creates a plan, deriving the kind from the label until the kind is edited', async () => {
    addTerm.mockResolvedValue('term-1')
    render(
      <PlanDialog appId="app-1" term={null} templates={templates} open onOpenChange={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Conference 2026' } })
    expect((screen.getByLabelText('Plan ID') as HTMLInputElement).value).toBe('conference-2026')
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'tpl-1' } })
    fireEvent.change(screen.getByLabelText('Valid for (days)'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /granted by you/i }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create plan' })))
    expect(addTerm).toHaveBeenCalledWith({
      kind: 'conference-2026',
      label: 'Conference 2026',
      templateId: 'tpl-1',
      validityDays: 30,
      issuers: ['INVITE_CODE', 'PUBLISHER_GRANT'],
    })
  })

  it('locks the kind of a published plan', () => {
    const term: PublisherTerm = {
      id: 'term-1',
      kind: '2026-pro',
      label: 'Pro',
      templateId: 'tpl-1',
      validityDays: null,
      issuers: ['INVITE_CODE'],
      status: 'ACTIVE',
      activeLicenses: 3,
    }
    render(
      <PlanDialog appId="app-1" term={term} templates={templates} open onOpenChange={vi.fn()} />,
    )
    expect((screen.getByLabelText('Plan ID') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText(/existing licences carry it/i)).toBeTruthy()
  })

  it('rejects a kind with spaces', async () => {
    render(
      <PlanDialog appId="app-1" term={null} templates={templates} open onOpenChange={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText('Plan ID'), { target: { value: 'Free Tier' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create plan' })))
    expect(screen.getByText(/lowercase letters, numbers and dashes/i)).toBeTruthy()
    expect(addTerm).not.toHaveBeenCalled()
  })
  it('sends null for fields emptied on a draft, and keeps the kind editable', async () => {
    setTerm.mockResolvedValue(true)
    const draft: PublisherTerm = {
      id: 'term-1', kind: '2026-pro', label: 'Pro', templateId: 'tpl-1', validityDays: 30,
      issuers: ['INVITE_CODE'], status: 'DRAFT', activeLicenses: 0,
    }
    render(<PlanDialog appId="app-1" term={draft} templates={templates} open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Valid for (days)'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: '__no_template__' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save plan' })))
    expect(setTerm).toHaveBeenCalledWith({
      termId: 'term-1', kind: '2026-pro', label: null, templateId: null, validityDays: null, issuers: ['INVITE_CODE'],
    })
  })

  it('will not save a published plan without a template', async () => {
    const live: PublisherTerm = {
      id: 'term-1', kind: '2026-pro', label: 'Pro', templateId: 'tpl-1', validityDays: null,
      issuers: ['INVITE_CODE'], status: 'ACTIVE', activeLicenses: 3,
    }
    render(<PlanDialog appId="app-1" term={live} templates={templates} open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: '__no_template__' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save plan' })))
    expect(screen.getByText(/needs a template and at least one way/i)).toBeTruthy()
    expect(setTerm).not.toHaveBeenCalled()
  })

  it('says so when there are no templates or they failed to load', () => {
    const { rerender } = render(<PlanDialog appId="app-1" term={null} templates={[]} open onOpenChange={vi.fn()} />)
    expect(screen.getByText(/no templates yet/i)).toBeTruthy()
    rerender(<PlanDialog appId="app-1" term={null} templates={[]} templatesUnavailable open onOpenChange={vi.fn()} />)
    expect(screen.getByText(/did not load/i)).toBeTruthy()
  })
  it('derives the plan ID again when a new plan is opened after an edited one', () => {
    const { rerender } = render(<PlanDialog appId="app-1" term={null} templates={templates} open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Plan ID'), { target: { value: 'custom-id' } })
    rerender(<PlanDialog appId="app-1" term={null} templates={templates} open={false} onOpenChange={vi.fn()} />)
    rerender(<PlanDialog appId="app-1" term={null} templates={templates} open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Fresh Plan' } })
    expect((screen.getByLabelText('Plan ID') as HTMLInputElement).value).toBe('fresh-plan')
  })

  it('reports both missing requirements on a published plan', async () => {
    const live: PublisherTerm = {
      id: 'term-1', kind: '2026-pro', label: 'Pro', templateId: 'tpl-1', validityDays: null,
      issuers: ['INVITE_CODE'], status: 'ACTIVE', activeLicenses: 3,
    }
    render(<PlanDialog appId="app-1" term={live} templates={templates} open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: '__no_template__' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /invite codes/i }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save plan' })))
    expect(screen.getAllByText(/needs a template and at least one way/i)).toHaveLength(2)
  })

  it('keeps the dialog open when saving fails', async () => {
    addTerm.mockRejectedValue(new Error('nope'))
    const onOpenChange = vi.fn()
    render(<PlanDialog appId="app-1" term={null} templates={templates} open onOpenChange={onOpenChange} />)
    fireEvent.change(screen.getByLabelText('Plan ID'), { target: { value: 'free-plan' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create plan' })))
    expect(addTerm).toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('cancel closes without sending', () => {
    const onOpenChange = vi.fn()
    render(<PlanDialog appId="app-1" term={null} templates={templates} open onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(addTerm).not.toHaveBeenCalled()
  })

  it('offers a retry when templates failed to load', () => {
    const retry = vi.fn()
    render(<PlanDialog appId="app-1" term={null} templates={[]} templatesUnavailable onRetryTemplates={retry} open onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalled()
  })
})
