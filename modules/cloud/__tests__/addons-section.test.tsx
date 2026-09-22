import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AddonsSection } from '@/modules/cloud/components/addons-section'
import type { CloudEnvironmentService } from '@/modules/cloud/types'

const service = (
  type: CloudEnvironmentService['type'],
  enabled: boolean,
): CloudEnvironmentService => ({
  type,
  prefix: type.toLowerCase(),
  enabled,
  url: null,
  status: 'ACTIVE',
  version: null,
  selectedRessource: null,
})

const toggle = () => screen.getByRole('switch', { name: /toggle document conversion/i })
const toggleState = () => toggle().getAttribute('data-state')

describe('AddonsSection', () => {
  it('reads OFF when the env has no docling service at all', () => {
    render(
      <AddonsSection
        services={[service('SWITCHBOARD', true)]}
        environmentStatus="READY"
        onToggleDocling={vi.fn()}
      />,
    )
    expect(toggleState()).toBe('unchecked')
    expect(screen.queryByText('OFF')).not.toBeNull()
  })

  it('reads ON when a docling service is enabled', () => {
    render(
      <AddonsSection
        services={[service('SWITCHBOARD', true), service('DOCLING', true)]}
        environmentStatus="READY"
        onToggleDocling={vi.fn()}
      />,
    )
    expect(toggleState()).toBe('checked')
  })

  it('reads OFF when the docling service exists but is switched off', () => {
    render(
      <AddonsSection
        services={[service('DOCLING', false)]}
        environmentStatus="READY"
        onToggleDocling={vi.fn()}
      />,
    )
    expect(toggleState()).toBe('unchecked')
  })

  it('calls onToggleDocling(true) when switched on', async () => {
    const onToggleDocling = vi.fn().mockResolvedValue(undefined)
    render(
      <AddonsSection services={[]} environmentStatus="READY" onToggleDocling={onToggleDocling} />,
    )
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggleDocling).toHaveBeenCalledWith(true))
  })

  it('calls onToggleDocling(false) when switched off', async () => {
    const onToggleDocling = vi.fn().mockResolvedValue(undefined)
    render(
      <AddonsSection
        services={[service('DOCLING', true)]}
        environmentStatus="READY"
        onToggleDocling={onToggleDocling}
      />,
    )
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggleDocling).toHaveBeenCalledWith(false))
  })

  // The optimistic wrapper must revert, or a failed mutation leaves the switch
  // showing a state the backend never accepted.
  it('reverts the switch when the mutation rejects', async () => {
    const onToggleDocling = vi.fn().mockRejectedValue(new Error('nope'))
    render(
      <AddonsSection services={[]} environmentStatus="READY" onToggleDocling={onToggleDocling} />,
    )
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggleDocling).toHaveBeenCalled())
    await waitFor(() => expect(toggleState()).toBe('unchecked'))
  })

  it('states the memory and serialisation cost up front', () => {
    render(<AddonsSection services={[]} environmentStatus="READY" onToggleDocling={vi.fn()} />)
    expect(screen.queryByText(/reserves ~2\s*GiB/i)).not.toBeNull()
    expect(screen.queryByText(/one document at a time/i)).not.toBeNull()
  })

  it('disables the switch while the environment has no workload', () => {
    render(<AddonsSection services={[]} environmentStatus="STOPPED" onToggleDocling={vi.fn()} />)
    expect(toggle().hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText(/unavailable while the environment is stopped/i)).not.toBeNull()
  })
})
