import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { PublisherTemplate } from '../types'

const setDetails = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useSetTemplateDetails: () => ({ mutateAsync: setDetails, isPending: false }),
}))
vi.mock('@/modules/cloud/hooks/use-environment', () => ({
  useViewer: () => ({ viewer: { address: '0xme', isAdmin: false }, isLoading: false }),
  useEnvironments: () => ({
    environments: [
      {
        id: 'env-9',
        name: 'Community',
        state: { label: 'Community', genericSubdomain: 'community' },
      },
    ],
    isPending: false,
    isError: false,
  }),
}))
vi.mock(
  '@/modules/shared/components/ui/select',
  () => import('@/modules/shared/test/native-select'),
)

import { TemplateDetailsForm } from '../components/templates/template-details-form'

const tpl = (over: Partial<PublisherTemplate> = {}): PublisherTemplate => ({
  id: 'tpl-1',
  name: 'Pro',
  mode: 'DEDICATED',
  sharedEnvironment: null,
  size: null,
  baseDomain: null,
  packageRegistry: null,
  services: [],
  packages: [],
  templateHash: 'h',
  environmentCount: 0,
  ...over,
})

describe('TemplateDetailsForm', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('opens Advanced as a disclosure that says whether it is open', () => {
    render(<TemplateDetailsForm appId="app-1" template={tpl()} guard={(_, run) => void run()} />)
    const toggle = screen.getByRole('button', { name: 'Advanced' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByLabelText('Base domain')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).toBeTruthy()
    expect(screen.getByLabelText('Base domain')).toBeTruthy()
  })

  it('keeps Save disabled until something changes', () => {
    render(<TemplateDetailsForm appId="app-1" template={tpl()} guard={(_, run) => void run()} />)
    expect(
      (screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('sends every field through the guard', async () => {
    setDetails.mockResolvedValue(true)
    const guard = vi.fn((_: string, run: () => Promise<unknown>) => void run())
    render(<TemplateDetailsForm appId="app-1" template={tpl()} guard={guard} />)
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'VETRA_AGENT_L' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })))
    expect(guard).toHaveBeenCalledWith('Save template changes?', expect.any(Function))
    expect(setDetails).toHaveBeenCalledWith({
      templateId: 'tpl-1',
      name: 'Pro',
      mode: 'DEDICATED',
      sharedEnvironment: null,
      size: 'VETRA_AGENT_L',
      baseDomain: null,
      packageRegistry: null,
    })
  })

  it('lets a shared template pick another of my environments', async () => {
    setDetails.mockResolvedValue(true)
    render(
      <TemplateDetailsForm
        appId="app-1"
        template={tpl({ mode: 'SHARED' })}
        guard={(_, run) => void run()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Shared environment'), { target: { value: 'env-9' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })))
    expect(setDetails.mock.calls[0][0]).toMatchObject({
      mode: 'SHARED',
      sharedEnvironment: 'env-9',
    })
  })

  it('explains why it cannot become shared while it runs services', () => {
    const t = tpl({
      services: [
        { id: 's', type: 'CONNECT', prefix: null, artifactName: null, artifactChannel: null },
      ],
    })
    render(<TemplateDetailsForm appId="app-1" template={t} guard={(_, run) => void run()} />)
    expect((screen.getByRole('radio', { name: /shared/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(screen.getByText(/remove its services and packages first/i)).toBeTruthy()
  })

  it('sends null for every optional field the publisher emptied', async () => {
    setDetails.mockResolvedValue(true)
    const t = tpl({
      name: 'Pro',
      size: 'VETRA_AGENT_L',
      baseDomain: 'a.io',
      packageRegistry: 'https://r.io',
    })
    render(<TemplateDetailsForm appId="app-1" template={t} guard={(_, run) => void run()} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: '__default_size__' } })
    fireEvent.change(screen.getByLabelText('Base domain'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Package registry'), { target: { value: '' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })))
    expect(setDetails).toHaveBeenCalledWith({
      templateId: 'tpl-1',
      name: null,
      mode: 'DEDICATED',
      sharedEnvironment: null,
      size: null,
      baseDomain: null,
      packageRegistry: null,
    })
  })
})
