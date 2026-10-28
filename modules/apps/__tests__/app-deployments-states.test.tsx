import { describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-apps', () => ({
  useRollbackApp: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { AppDeployments } from '../components/app-deployments'
import type { App } from '../types'

const app = {
  id: 'app-1',
  status: 'ACTIVE',
  productionBranch: 'main',
  repository: { fullName: 'acme/app' },
} as unknown as App

describe('AppDeployments states', () => {
  beforeEach(() => cleanup())

  it('shows a skeleton while loading', () => {
    render(<AppDeployments app={app} deployments={[]} isPending error={null} onRetry={vi.fn()} />)
    expect(screen.getByRole('status', { name: 'Loading deployments' })).toBeTruthy()
  })

  it('offers a retry when the history fails to load', () => {
    const onRetry = vi.fn()
    render(
      <AppDeployments
        app={app}
        deployments={[]}
        isPending={false}
        error={new Error('boom')}
        onRetry={onRetry}
      />,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows the empty state when there are no deployments', () => {
    render(
      <AppDeployments
        app={app}
        deployments={[]}
        isPending={false}
        error={null}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText('No deployments yet')).toBeTruthy()
    expect(screen.getByText(/every push to main/i)).toBeTruthy()
  })
})
