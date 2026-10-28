import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  EnvironmentControllerProvider,
  useEnvironmentControllerContext,
} from '../providers/environment-controller-provider'

vi.mock('../hooks/use-environment-controller', () => ({
  useEnvironmentController: vi.fn(),
}))

import { useEnvironmentController } from '../hooks/use-environment-controller'

function Probe() {
  const ctx = useEnvironmentControllerContext()
  return (
    <div data-testid="probe">
      {ctx.state ? (ctx.state as { label?: string }).label : 'no state'}
    </div>
  )
}

describe('EnvironmentControllerProvider', () => {
  it('throws when used outside provider', () => {
    // Suppress React error output for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/EnvironmentControllerProvider/i)
    spy.mockRestore()
  })

  it('exposes the hook result via context', () => {
    vi.mocked(useEnvironmentController).mockReturnValue({
      controller: null,
      state: { label: 'hello' } as never,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      retry: vi.fn(),
    })
    render(
      <EnvironmentControllerProvider documentId="doc1">
        <Probe />
      </EnvironmentControllerProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe('hello')
  })
})
