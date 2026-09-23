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

const cases = [
  { type: 'DOCLING' as const, prefix: 'docling', name: /toggle document conversion/i },
  { type: 'PAPERLESS' as const, prefix: 'paperless', name: /toggle document archive/i },
]

describe.each(cases)('AddonsSection — $type', ({ type, prefix, name }) => {
  const toggle = () => screen.getByRole('switch', { name })
  const state = () => toggle().getAttribute('data-state')

  it('reads OFF when the env has no such service', () => {
    render(<AddonsSection services={[service('SWITCHBOARD', true)]} environmentStatus="READY" onToggleAddon={vi.fn()} />)
    expect(state()).toBe('unchecked')
  })

  it('reads ON when the service is enabled', () => {
    render(<AddonsSection services={[service(type, true)]} environmentStatus="READY" onToggleAddon={vi.fn()} />)
    expect(state()).toBe('checked')
  })

  it('reads OFF when the service exists but is switched off', () => {
    render(<AddonsSection services={[service(type, false)]} environmentStatus="READY" onToggleAddon={vi.fn()} />)
    expect(state()).toBe('unchecked')
  })

  it('calls onToggleAddon(type, prefix, true) when switched on', async () => {
    const onToggleAddon = vi.fn().mockResolvedValue(undefined)
    render(<AddonsSection services={[]} environmentStatus="READY" onToggleAddon={onToggleAddon} />)
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggleAddon).toHaveBeenCalledWith(type, prefix, true))
  })

  it('calls onToggleAddon(type, prefix, false) when switched off', async () => {
    const onToggleAddon = vi.fn().mockResolvedValue(undefined)
    render(<AddonsSection services={[service(type, true)]} environmentStatus="READY" onToggleAddon={onToggleAddon} />)
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggleAddon).toHaveBeenCalledWith(type, prefix, false))
  })

  it('reverts the switch when the mutation rejects', async () => {
    const onToggleAddon = vi.fn().mockRejectedValue(new Error('nope'))
    render(<AddonsSection services={[]} environmentStatus="READY" onToggleAddon={onToggleAddon} />)
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggleAddon).toHaveBeenCalled())
    await waitFor(() => expect(state()).toBe('unchecked'))
  })

  it('disables the switch while the environment has no workload', () => {
    render(<AddonsSection services={[]} environmentStatus="STOPPED" onToggleAddon={vi.fn()} />)
    expect(toggle().hasAttribute('disabled')).toBe(true)
  })
})

describe('AddonsSection — independence and cost text', () => {
  it('toggling one add-on leaves the other unchanged', async () => {
    const onToggleAddon = vi.fn().mockResolvedValue(undefined)
    render(<AddonsSection services={[service('DOCLING', true)]} environmentStatus="READY" onToggleAddon={onToggleAddon} />)
    fireEvent.click(screen.getByRole('switch', { name: /toggle document archive/i }))
    await waitFor(() => expect(onToggleAddon).toHaveBeenCalledWith('PAPERLESS', 'paperless', true))
    expect(screen.getByRole('switch', { name: /toggle document conversion/i }).getAttribute('data-state')).toBe('checked')
  })

  it('states each cost up front', () => {
    render(<AddonsSection services={[]} environmentStatus="READY" onToggleAddon={vi.fn()} />)
    expect(screen.queryByText(/reserves ~2\s*GiB/i)).not.toBeNull()
    expect(screen.queryByText(/one document at a time/i)).not.toBeNull()
    expect(screen.queryByText(/reserves ~1\.5\s*GiB/i)).not.toBeNull()
    expect(screen.queryByText(/single sign-on/i)).not.toBeNull()
  })

  it('shows the unavailable note once, not per add-on', () => {
    render(<AddonsSection services={[]} environmentStatus="STOPPED" onToggleAddon={vi.fn()} />)
    expect(screen.getAllByText(/unavailable while the environment is stopped/i)).toHaveLength(1)
  })
})
