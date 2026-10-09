import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { PublisherApiError } from '@/modules/publisher/graphql'
import type { RenownAppProfile } from '../lib/app-profile/api'

const DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
const NOTES = {
  id: 'm1',
  key: 'notes',
  label: 'Notes',
  unit: 'notes',
  description: null,
  aggregation: 'SUM' as const,
  public: true,
}
const STORED: RenownAppProfile = {
  appDid: DID,
  documentId: 'doc-9',
  name: 'Vault',
  tagline: null,
  logo: null,
  website: null,
  publisherDid: null,
  description: null,
  category: null,
  logoRef: null,
  coverRef: null,
  links: [],
  metrics: [NOTES],
}

let profile: {
  data: RenownAppProfile | null
  isPending: boolean
  error: Error | null
  refetch: () => void
}
const mutateAsync = vi.fn()

vi.mock('../hooks/use-app-profile', () => ({
  useAppProfile: () => profile,
  useUpdateAppProfile: () => ({ mutateAsync, isPending: false }),
  useRenownBearer: () => async () => 'bearer',
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AppProfileTab } from '../components/profile/profile-tab'

const saveButton = () => screen.getByRole('button', { name: 'Save profile' }) as HTMLButtonElement
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  cleanup()
  mutateAsync.mockReset()
  profile = { data: STORED, isPending: false, error: null, refetch: vi.fn() }
})

describe('Profile tab metrics', () => {
  it('lists the declared metrics and links to the guide', () => {
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    expect((screen.getByLabelText('Metric 1 key') as HTMLInputElement).value).toBe('notes')
    expect((screen.getByLabelText('Metric 1 aggregation') as HTMLSelectElement).value).toBe('SUM')
    expect(screen.getByRole('link', { name: 'How to report stats' }).getAttribute('href')).toBe(
      '/docs/app-stats',
    )
    expect(screen.getByText('1/16')).toBeTruthy()
  })

  it('declares a metric and saves only the metric list', async () => {
    mutateAsync.mockResolvedValue(true)
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add metric' }))
    type('Metric 2 label', 'Best streak')
    type('Metric 2 key', 'streak')
    type('Metric 2 unit', 'days')
    fireEvent.change(screen.getByLabelText('Metric 2 aggregation'), { target: { value: 'MAX' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Metric 2 public' }))
    expect(saveButton().disabled).toBe(false)
    fireEvent.click(saveButton())
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(mutateAsync.mock.calls[0]?.[0]).toEqual({
      metrics: [
        { ...NOTES },
        {
          id: expect.any(String),
          key: 'streak',
          label: 'Best streak',
          unit: 'days',
          description: null,
          aggregation: 'MAX',
          public: false,
        },
      ],
    })
  })

  it('blocks saving a duplicate key and says why', () => {
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add metric' }))
    type('Metric 2 label', 'Again')
    type('Metric 2 key', 'notes')
    expect(screen.getByRole('alert').textContent).toMatch(/the key “notes” is used twice/)
    expect(saveButton().disabled).toBe(true)
  })

  it('reorders and removes metrics', async () => {
    mutateAsync.mockResolvedValue(true)
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove metric 1' }))
    fireEvent.click(saveButton())
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ metrics: [] }))
  })

  it('shows Renown refusing the list under Metrics', async () => {
    mutateAsync.mockRejectedValue(
      new PublisherApiError(
        'INVALID_INPUT',
        'Metric labels must be 1-40 characters',
        200,
        'metrics',
      ),
    )
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    type('Metric 1 description', 'Notes written in any vault')
    fireEvent.click(saveButton())
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Metric labels must be 1-40 characters'),
    )
  })
})
