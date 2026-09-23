import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  AddonsSection,
  type AddonId,
  type AddonStatus,
} from '@/modules/cloud/components/addons-section'
import type { CloudEnvironmentStatus } from '@/modules/cloud/types'

type Overrides = {
  environmentStatus?: CloudEnvironmentStatus
  status?: Partial<Record<AddonId, AddonStatus>>
  onToggleAddon?: (id: AddonId, enabled: boolean) => Promise<void>
}

const renderSection = (o: Overrides = {}) =>
  render(
    <AddonsSection
      environmentStatus={o.environmentStatus ?? 'READY'}
      status={{
        docling: { enabled: false },
        paperless: { enabled: false },
        workflows: { enabled: false },
        ...o.status,
      }}
      onToggleAddon={o.onToggleAddon ?? vi.fn()}
    />,
  )

const cases = [
  { id: 'docling' as const, name: /toggle document conversion/i },
  { id: 'paperless' as const, name: /toggle document archive/i },
  { id: 'workflows' as const, name: /toggle workflows/i },
]

describe.each(cases)('AddonsSection — $id', ({ id, name }) => {
  const toggle = () => screen.getByRole('switch', { name })
  const state = () => toggle().getAttribute('data-state')

  it('reads ON when its status is enabled', () => {
    renderSection({ status: { [id]: { enabled: true } } })
    expect(state()).toBe('checked')
  })

  it('reads OFF when its status is disabled', () => {
    renderSection()
    expect(state()).toBe('unchecked')
  })

  it('calls onToggleAddon(id, true) when switched on', async () => {
    const onToggleAddon = vi.fn().mockResolvedValue(undefined)
    renderSection({ onToggleAddon })
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggleAddon).toHaveBeenCalledWith(id, true))
  })

  it('calls onToggleAddon(id, false) when switched off', async () => {
    const onToggleAddon = vi.fn().mockResolvedValue(undefined)
    renderSection({ status: { [id]: { enabled: true } }, onToggleAddon })
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggleAddon).toHaveBeenCalledWith(id, false))
  })

  // The optimistic wrapper must revert, or a failed mutation leaves the switch
  // showing a state the backend never accepted.
  it('reverts the switch when the mutation rejects', async () => {
    const onToggleAddon = vi.fn().mockRejectedValue(new Error('nope'))
    renderSection({ onToggleAddon })
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggleAddon).toHaveBeenCalled())
    await waitFor(() => expect(state()).toBe('unchecked'))
  })

  it('disables the switch while the environment has no workload', () => {
    renderSection({ environmentStatus: 'STOPPED' })
    expect(toggle().hasAttribute('disabled')).toBe(true)
  })

  it('disables the switch and says why when unavailable', () => {
    renderSection({ status: { [id]: { enabled: false, unavailable: 'Not right now.' } } })
    expect(toggle().hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText('Not right now.')).not.toBeNull()
  })
})

describe('AddonsSection — independence and cost text', () => {
  it('toggling one add-on leaves the other unchanged', async () => {
    const onToggleAddon = vi.fn().mockResolvedValue(undefined)
    renderSection({ status: { docling: { enabled: true } }, onToggleAddon })
    fireEvent.click(screen.getByRole('switch', { name: /toggle document archive/i }))
    await waitFor(() => expect(onToggleAddon).toHaveBeenCalledWith('paperless', true))
    expect(
      screen
        .getByRole('switch', { name: /toggle document conversion/i })
        .getAttribute('data-state'),
    ).toBe('checked')
  })

  it('states each cost up front', () => {
    renderSection()
    expect(screen.queryByText(/reserves ~2\s*GiB/i)).not.toBeNull()
    expect(screen.queryByText(/one document at a time/i)).not.toBeNull()
    expect(screen.queryByText(/reserves ~1\.5\s*GiB/i)).not.toBeNull()
    expect(screen.queryByText(/single sign-on/i)).not.toBeNull()
  })

  it('shows the unavailable note once, not per add-on', () => {
    renderSection({ environmentStatus: 'STOPPED' })
    expect(screen.getAllByText(/unavailable while the environment is stopped/i)).toHaveLength(1)
  })
})

describe('AddonsSection — workflows', () => {
  // The Connect half sits in CHANGES_PENDING until deployed; unsaid, a user
  // reads the unchanged Connect as the toggle having failed.
  it('says the Connect half needs a deploy', () => {
    renderSection()
    expect(screen.queryByText(/rolls out on your next approve \/ deploy/i)).not.toBeNull()
  })

  it('shows the unavailable reason in place of the deploy note', () => {
    renderSection({ status: { workflows: { enabled: false, unavailable: 'Not supported.' } } })
    expect(screen.queryByText('Not supported.')).not.toBeNull()
    expect(screen.queryByText(/rolls out on your next approve \/ deploy/i)).toBeNull()
  })
})
