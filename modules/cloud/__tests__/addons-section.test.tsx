import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { AddonsSection } from '@/modules/cloud/components/addons-section'
import type { AddonConfigStore, AddonId, AddonStatus } from '@/modules/cloud/lib/addons'
import type { CloudEnvironmentStatus } from '@/modules/cloud/types'

type Overrides = {
  environmentStatus?: CloudEnvironmentStatus
  status?: Partial<Record<AddonId, AddonStatus>>
  onToggleAddon?: (id: AddonId, enabled: boolean) => Promise<void>
  configStore?: AddonConfigStore
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
      configStore={o.configStore}
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
    const onToggleAddon = vi.fn()
    renderSection({
      status: { [id]: { enabled: false, unavailable: 'Not right now.' } },
      onToggleAddon,
    })
    expect(toggle().hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText('Not right now.')).not.toBeNull()
    fireEvent.click(toggle())
    expect(onToggleAddon).not.toHaveBeenCalled()
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
  // The reactor restarts at once but Connect sits in CHANGES_PENDING until
  // deployed; unsaid, a user reads the unchanged Connect as a failed toggle.
  it('says when each half takes effect', () => {
    renderSection()
    expect(screen.queryByText(/restarts the reactor right away/i)).not.toBeNull()
    expect(screen.queryByText(/next approve \/ deploy/i)).not.toBeNull()
  })

  it('shows the unavailable reason in place of the deploy note', () => {
    renderSection({ status: { workflows: { enabled: false, unavailable: 'Not supported.' } } })
    expect(screen.queryByText('Not supported.')).not.toBeNull()
    expect(screen.queryByText(/next approve \/ deploy/i)).toBeNull()
  })
})

describe('AddonsSection — settings', () => {
  const store = (o: Partial<AddonConfigStore> = {}): AddonConfigStore => ({
    envVars: [],
    secrets: [],
    setVar: vi.fn().mockResolvedValue(undefined),
    setSecret: vi.fn().mockResolvedValue(undefined),
    deleteVar: vi.fn().mockResolvedValue(undefined),
    deleteSecret: vi.fn().mockResolvedValue(undefined),
    ...o,
  })

  it('shows a settings button only for add-ons that declare settings', () => {
    renderSection({ configStore: store() })
    expect(screen.queryByRole('button', { name: /workflows settings/i })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /document conversion settings/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /document archive settings/i })).toBeNull()
  })

  it('disables settings until tenant config has loaded', () => {
    renderSection()
    expect(
      screen.getByRole('button', { name: /workflows settings/i }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('lists each setting with its current value or default', async () => {
    renderSection({
      configStore: store({ envVars: [{ key: 'PH_WORKFLOWS_RUN_CONCURRENCY', value: '8' }] }),
    })
    fireEvent.click(screen.getByRole('button', { name: /workflows settings/i }))
    await waitFor(() => expect(screen.queryByText('Run concurrency')).not.toBeNull())
    expect(screen.queryByText('8')).not.toBeNull()
    expect(screen.queryByText('Secrets encryption key')).not.toBeNull()
    expect(screen.queryByText('60000')).not.toBeNull()
  })
})

describe('AddonsSection — confirmation', () => {
  // The toggle only queues a change; a toast on write would sit over the
  // Approve prompt and claim something that hasn't happened yet.
  it('confirms only after the change has deployed', async () => {
    const success = vi.spyOn(toast, 'success')
    const onToggleAddon = vi.fn().mockResolvedValue(undefined)
    const status = (enabled: boolean) => ({
      docling: { enabled: false },
      paperless: { enabled: false },
      workflows: { enabled },
    })
    const { rerender } = render(
      <AddonsSection
        environmentStatus="READY"
        status={status(false)}
        onToggleAddon={onToggleAddon}
      />,
    )
    fireEvent.click(screen.getByRole('switch', { name: /toggle workflows/i }))
    await waitFor(() => expect(onToggleAddon).toHaveBeenCalledWith('workflows', true))
    for (const environmentStatus of ['CHANGES_PENDING', 'DEPLOYING'] as const) {
      rerender(
        <AddonsSection
          environmentStatus={environmentStatus}
          status={status(true)}
          onToggleAddon={onToggleAddon}
        />,
      )
    }
    expect(success).not.toHaveBeenCalled()
    rerender(
      <AddonsSection
        environmentStatus="READY"
        status={status(true)}
        onToggleAddon={onToggleAddon}
      />,
    )
    await waitFor(() => expect(success).toHaveBeenCalledWith('Workflows enabled'))
    success.mockRestore()
  })
})
