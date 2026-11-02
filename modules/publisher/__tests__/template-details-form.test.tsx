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

const warmPoolData = vi.fn(() => ({ data: { estimatePerEnvironmentEur: 80 } as unknown }))
vi.mock('../hooks/use-publisher', () => ({
  useWarmPool: (...a: unknown[]) => (warmPoolData as (...x: unknown[]) => unknown)(...a),
}))

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
  warmPoolSize: 0,
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
      warmPoolSize: 0,
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
      warmPoolSize: 0,
    })
  })

  describe('warm environments', () => {
    const renderForm = (over: Partial<PublisherTemplate> = {}) =>
      render(
        <TemplateDetailsForm appId="app-1" template={tpl(over)} guard={(_, run) => void run()} />,
      )
    const field = () => screen.getByLabelText('Warm environments') as HTMLInputElement
    const saveBtn = () => screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement
    const save = () => act(async () => fireEvent.click(saveBtn()))

    it('shows the field, hint and contract note only for dedicated templates', () => {
      renderForm()
      expect(field().min).toBe('0')
      expect(field().max).toBe('10')
      expect(field().step).toBe('1')
      expect(
        screen.getByText('Kept running and ready to hand out. You pay for them while they wait.'),
      ).toBeTruthy()
      expect(
        screen.getByText(
          'Warm environments start before anyone owns them. Your app must start without an owner and create nothing for a person until it is claimed.',
        ),
      ).toBeTruthy()
      cleanup()
      renderForm({ mode: 'SHARED' })
      expect(screen.queryByLabelText('Warm environments')).toBeNull()
      expect(screen.queryByText(/start before anyone owns them/)).toBeNull()
    })

    it('estimates the monthly cost, and none at 0', () => {
      renderForm()
      expect(screen.queryByText(/estimate\)/)).toBeNull()
      fireEvent.change(field(), { target: { value: '3' } })
      expect(screen.getByText('≈ €240/month (estimate)')).toBeTruthy()
      fireEvent.change(field(), { target: { value: '0' } })
      expect(screen.queryByText(/estimate\)/)).toBeNull()
    })

    it('saves the typed count, and an emptied field as 0', async () => {
      setDetails.mockResolvedValue(true)
      renderForm()
      fireEvent.change(field(), { target: { value: '3' } })
      await save()
      expect(setDetails.mock.calls[0][0]).toMatchObject({ warmPoolSize: 3 })
      cleanup()
      renderForm({ warmPoolSize: 2 })
      expect(saveBtn().disabled).toBe(true)
      fireEvent.change(field(), { target: { value: '' } })
      expect(saveBtn().disabled).toBe(false)
      await save()
      expect(setDetails.mock.calls[1][0]).toMatchObject({ warmPoolSize: 0 })
    })

    it('treats an empty field and 0 as the same for an unchanged template', () => {
      renderForm()
      fireEvent.change(field(), { target: { value: '0' } })
      expect(saveBtn().disabled).toBe(true)
      fireEvent.change(field(), { target: { value: '' } })
      expect(saveBtn().disabled).toBe(true)
    })

    it('shows the server message and keeps the value when the count is refused', async () => {
      const { toast } = await import('sonner')
      setDetails.mockRejectedValue(
        Object.assign(new Error('At most 5 warm environments for this app.'), {
          code: 'WARM_POOL_TOO_LARGE',
        }),
      )
      renderForm()
      fireEvent.change(field(), { target: { value: '9' } })
      await save()
      expect(toast.error).toHaveBeenCalledWith('At most 5 warm environments for this app.')
      expect(field().value).toBe('9')
    })

    it('saves 0 when a template that kept environments warm becomes shared', async () => {
      setDetails.mockResolvedValue(true)
      renderForm({ warmPoolSize: 2 })
      fireEvent.click(screen.getByRole('radio', { name: /shared/i }))
      await save()
      expect(setDetails.mock.calls[0][0]).toMatchObject({ mode: 'SHARED', warmPoolSize: 0 })
    })

    it.each(['11', '-1', '2.5'])('cannot submit %s', (value) => {
      renderForm()
      fireEvent.change(field(), { target: { value } })
      expect(saveBtn().disabled).toBe(true)
      expect(screen.queryByText(/estimate\)/)).toBeNull()
    })

    it.each(['11', '-1', '2.5'])('says why %s is refused', (value) => {
      renderForm()
      expect(screen.queryByText('Enter a whole number from 0 to 10.')).toBeNull()
      fireEvent.change(field(), { target: { value } })
      const msg = screen.getByText('Enter a whole number from 0 to 10.')
      expect(msg.id).toBeTruthy()
      expect((field().getAttribute('aria-describedby') ?? '').split(' ')).toContain(msg.id)
    })

    it('describes the field by the hint and the app-contract note', () => {
      renderForm()
      const ids = (field().getAttribute('aria-describedby') ?? '').split(' ')
      const hint = screen.getByText(/Kept running and ready to hand out/)
      const note = screen.getByText(/start before anyone owns them/)
      expect(hint.id).toBeTruthy()
      expect(note.id).toBeTruthy()
      expect(ids).toContain(hint.id)
      expect(ids).toContain(note.id)
    })

    it('refuses an unparseable entry such as a stray "-" or "e"', () => {
      renderForm()
      fireEvent.change(field(), { target: { value: '3' } })
      Object.defineProperty(field(), 'validity', {
        configurable: true,
        value: { badInput: true },
      })
      fireEvent.change(field(), { target: { value: '' } })
      expect(saveBtn().disabled).toBe(true)
      expect(field().getAttribute('aria-invalid')).toBe('true')
      expect(screen.getByText('Enter a whole number from 0 to 10.')).toBeTruthy()
      Object.defineProperty(field(), 'validity', {
        configurable: true,
        value: { badInput: false },
      })
      fireEvent.change(field(), { target: { value: '2' } })
      expect(screen.queryByText('Enter a whole number from 0 to 10.')).toBeNull()
    })

    it('shows the estimate only for the saved size', () => {
      renderForm({ size: 'SMALL' as PublisherTemplate['size'] })
      fireEvent.change(field(), { target: { value: '3' } })
      expect(screen.getByText('≈ €240/month (estimate)')).toBeTruthy()
      expect(screen.queryByText('Save to see the estimate for this size.')).toBeNull()
      fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'LARGE' } })
      expect(screen.queryByText(/€/)).toBeNull()
      expect(screen.getByText('Save to see the estimate for this size.')).toBeTruthy()
      fireEvent.change(field(), { target: { value: '0' } })
      expect(screen.queryByText('Save to see the estimate for this size.')).toBeNull()
    })
  })
})
