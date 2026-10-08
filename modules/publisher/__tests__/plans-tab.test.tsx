import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import type { PublisherTemplate, PublisherTerm } from '../types'

let terms: PublisherTerm[] = []
let termsState: { isPending: boolean; error: Error | null } = { isPending: false, error: null }
const refetchTerms = vi.fn()
const publish = vi.fn()
const retire = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher', () => ({
  usePublisherTerms: () => ({ data: terms, ...termsState, refetch: refetchTerms }),
  usePublisherTemplates: () => ({
    data: [{ id: 'tpl-1', name: 'Workspace', mode: 'DEDICATED' } as PublisherTemplate],
    isPending: false,
    error: null,
  }),
}))
vi.mock('../hooks/use-publisher-mutations', () => ({
  usePublishTerm: () => ({ mutateAsync: publish, isPending: false }),
  useRetireTerm: () => ({ mutateAsync: retire, isPending: false }),
  useAddTerm: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetTermDetails: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

import { PlansTab } from '../components/plans/plans-tab'

const term = (over: Partial<PublisherTerm>): PublisherTerm => ({
  id: 'term-1',
  kind: '2026-pro',
  label: 'Pro',
  templateId: 'tpl-1',
  validityDays: 30,
  issuers: ['PUBLISHER_GRANT', 'INVITE_CODE'],
  status: 'DRAFT',
  activeLicenses: 0,
  ...over,
})

describe('PlansTab', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    termsState = { isPending: false, error: null }
  })

  it('points at templates when there are no plans', () => {
    terms = []
    render(<PlansTab appId="app-1" />)
    expect(screen.getByText('No plans yet')).toBeTruthy()
  })

  it('summarises a plan in one row', () => {
    terms = [term({ status: 'ACTIVE', activeLicenses: 12 })]
    render(<PlansTab appId="app-1" />)
    const row = screen.getByTestId('plan-term-1')
    expect(within(row).getByText('Pro')).toBeTruthy()
    expect(within(row).getByText('2026-pro')).toBeTruthy()
    expect(within(row).getByText('Published')).toBeTruthy()
    expect(within(row).getByText('Workspace')).toBeTruthy()
    expect(within(row).getByText('30 days')).toBeTruthy()
    expect(within(row).getByText('Granted by you, Invite codes')).toBeTruthy()
    expect(within(row).getByText('12 active licences')).toBeTruthy()
  })

  it('explains why a draft cannot be published yet', () => {
    terms = [term({ templateId: null })]
    render(<PlansTab appId="app-1" />)
    const row = screen.getByTestId('plan-term-1')
    expect(
      (within(row).getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(within(row).getByText('Pick a template first.')).toBeTruthy()
  })

  it('publishes after confirmation', async () => {
    terms = [term({})]
    publish.mockResolvedValue(true)
    render(<PlansTab appId="app-1" />)
    fireEvent.click(
      within(screen.getByTestId('plan-term-1')).getByRole('button', { name: 'Publish' }),
    )
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Publish plan' })))
    expect(publish).toHaveBeenCalledWith({ termId: 'term-1' })
  })

  it('retires a published plan after confirmation, keeping existing holders', async () => {
    terms = [term({ status: 'ACTIVE' })]
    retire.mockResolvedValue(true)
    render(<PlansTab appId="app-1" />)
    fireEvent.click(
      within(screen.getByTestId('plan-term-1')).getByRole('button', { name: 'Retire' }),
    )
    expect(screen.getByText(/existing licences run until they end/i)).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retire plan' })))
    expect(retire).toHaveBeenCalledWith({ termId: 'term-1' })
  })
  it('shows a skeleton while plans load, never an empty claim', () => {
    terms = []
    termsState = { isPending: true, error: null }
    render(<PlansTab appId="app-1" />)
    expect(screen.getByRole('status', { name: 'Loading plans' })).toBeTruthy()
    expect(screen.queryByText('No plans yet')).toBeNull()
  })

  it('offers a retry when plans fail to load', () => {
    terms = []
    termsState = { isPending: false, error: new Error('boom') }
    render(<PlansTab appId="app-1" />)
    expect(screen.queryByText('No plans yet')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetchTerms).toHaveBeenCalled()
  })

  it('offers to publish a retired plan again', () => {
    terms = [term({ status: 'RETIRED' })]
    render(<PlansTab appId="app-1" />)
    expect(screen.getByRole('button', { name: 'Publish again' })).toBeTruthy()
  })
})
