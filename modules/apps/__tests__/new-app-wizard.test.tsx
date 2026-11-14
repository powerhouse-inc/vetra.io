import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

const mutate = vi.fn()
vi.mock('../hooks/use-apps', () => ({
  useCreateApp: () => ({ mutate, isPending: false, error: null }),
}))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useActiveOrg: () => ({ orgId: null, org: null }),
}))
vi.mock('@/modules/cloud/hooks/use-environment', () => ({
  useViewer: () => ({ viewer: { address: '0xabc' } }),
  useEnvironments: () => {
    throw new Error('the wizard must not load environments')
  },
}))

import { ConfigureStep } from '../components/new-app-wizard'

const draft = {
  installationId: '77',
  repo: { id: '4242', fullName: 'acme/shop', defaultBranch: 'main', private: false },
  name: 'Shop',
  productionBranch: 'main',
}

describe('ConfigureStep', () => {
  it('asks for no environment and creates the app without one', () => {
    render(<ConfigureStep draft={draft} update={vi.fn()} onBack={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.queryByText(/environment/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /create app/i }))
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0]).not.toHaveProperty('productionEnvironmentId')
  })
})
