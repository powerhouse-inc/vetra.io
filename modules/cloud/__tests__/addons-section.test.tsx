import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { AddonsSection } from '@/modules/cloud/components/addons-section'
import type { AddonConfigStore, AddonControl, AddonId } from '@/modules/cloud/lib/addons'
import type { CloudEnvironmentStatus } from '@/modules/cloud/types'

type Overrides = {
  environmentStatus?: CloudEnvironmentStatus
  addons?: Partial<Record<AddonId, Partial<AddonControl>>>
  configStore?: AddonConfigStore
}

const control = (o: Partial<AddonControl> = {}): AddonControl => ({
  enabled: false,
  toggle: vi.fn().mockResolvedValue(undefined),
  ...o,
})

const addonsFrom = (o: Overrides['addons'] = {}): Record<AddonId, AddonControl> => ({
  docling: control(o.docling),
  paperless: control(o.paperless),
  speckle: control(o.speckle),
  workflows: control(o.workflows),
})

const renderSection = (o: Overrides = {}) =>
  render(
    <AddonsSection
      environmentStatus={o.environmentStatus ?? 'READY'}
      addons={addonsFrom(o.addons)}
      configStore={o.configStore}
    />,
  )

const cases = [
  { id: 'docling' as const, name: /toggle document conversion/i },
  { id: 'paperless' as const, name: /toggle document archive/i },
  { id: 'speckle' as const, name: /toggle 3d models \(speckle\)/i },
  { id: 'workflows' as const, name: /toggle workflows/i },
]

describe.each(cases)('AddonsSection — $id', ({ id, name }) => {
  const toggle = () => screen.getByRole('switch', { name })
  const state = () => toggle().getAttribute('data-state')

  it('reads ON when its status is enabled', () => {
    renderSection({ addons: { [id]: { enabled: true } } })
    expect(state()).toBe('checked')
  })

  it('reads OFF when its status is disabled', () => {
    renderSection()
    expect(state()).toBe('unchecked')
  })

  it('calls its own toggle(true) when switched on', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    renderSection({ addons: { [id]: { toggle: onToggle } } })
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggle).toHaveBeenCalledWith(true))
  })

  it('calls its own toggle(false) when switched off', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    renderSection({ addons: { [id]: { enabled: true, toggle: onToggle } } })
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggle).toHaveBeenCalledWith(false))
  })

  // The optimistic wrapper must revert, or a failed mutation leaves the switch
  // showing a state the backend never accepted.
  it('reverts the switch when the mutation rejects', async () => {
    const onToggle = vi.fn().mockRejectedValue(new Error('nope'))
    renderSection({ addons: { [id]: { toggle: onToggle } } })
    fireEvent.click(toggle())
    await waitFor(() => expect(onToggle).toHaveBeenCalled())
    await waitFor(() => expect(state()).toBe('unchecked'))
  })

  it('disables the switch while the environment has no workload', () => {
    renderSection({ environmentStatus: 'STOPPED' })
    expect(toggle().hasAttribute('disabled')).toBe(true)
  })

  it('disables the switch and says why when unavailable', () => {
    const onToggle = vi.fn()
    renderSection({ addons: { [id]: { unavailable: 'Not right now.', toggle: onToggle } } })
    expect(toggle().hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText('Not right now.')).not.toBeNull()
    fireEvent.click(toggle())
    expect(onToggle).not.toHaveBeenCalled()
  })
})

describe('AddonsSection — independence and cost text', () => {
  it('toggling one add-on leaves the other unchanged', async () => {
    const docling = vi.fn().mockResolvedValue(undefined)
    const paperless = vi.fn().mockResolvedValue(undefined)
    renderSection({
      addons: { docling: { enabled: true, toggle: docling }, paperless: { toggle: paperless } },
    })
    fireEvent.click(screen.getByRole('switch', { name: /toggle document archive/i }))
    await waitFor(() => expect(paperless).toHaveBeenCalledWith(true))
    expect(docling).not.toHaveBeenCalled()
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
    expect(screen.queryByText(/private speckle server \(~2\s*GiB\)/i)).not.toBeNull()
  })

  it('shows the unavailable note once, not per add-on', () => {
    renderSection({ environmentStatus: 'STOPPED' })
    expect(screen.getAllByText(/unavailable while the environment is stopped/i)).toHaveLength(1)
  })
})

describe('AddonsSection — links', () => {
  const href = 'https://tall-duck-ab12-speckle.vetra.io'
  const link = () => screen.queryByRole('link', { name: /open speckle/i })

  it('links to the add-on while it is enabled', () => {
    renderSection({ addons: { speckle: { enabled: true, href, hrefLabel: 'Open Speckle' } } })
    expect(link()?.getAttribute('href')).toBe(href)
    expect(link()?.getAttribute('target')).toBe('_blank')
    expect(link()?.getAttribute('rel')).toMatch(/noopener/)
  })

  it('shows no link while it is disabled', () => {
    renderSection({ addons: { speckle: { enabled: false, href, hrefLabel: 'Open Speckle' } } })
    expect(link()).toBeNull()
  })

  // The host only exists once the change is deployed, so an optimistic switch
  // must not surface a link to it.
  it('shows no link right after switching on', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    renderSection({ addons: { speckle: { href, hrefLabel: 'Open Speckle', toggle: onToggle } } })
    fireEvent.click(screen.getByRole('switch', { name: /toggle 3d models/i }))
    await waitFor(() => expect(onToggle).toHaveBeenCalledWith(true))
    expect(link()).toBeNull()
  })

  it('adds no link to add-ons without an href', () => {
    renderSection({ addons: { docling: { enabled: true }, paperless: { enabled: true } } })
    expect(screen.queryAllByRole('link')).toHaveLength(0)
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
    renderSection({ addons: { workflows: { unavailable: 'Not supported.' } } })
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
    expect(screen.queryByRole('button', { name: /3d models \(speckle\) settings/i })).toBeNull()
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
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const addons = (enabled: boolean) => addonsFrom({ workflows: { enabled, toggle: onToggle } })
    const { rerender } = render(<AddonsSection environmentStatus="READY" addons={addons(false)} />)
    fireEvent.click(screen.getByRole('switch', { name: /toggle workflows/i }))
    await waitFor(() => expect(onToggle).toHaveBeenCalledWith(true))
    for (const environmentStatus of ['CHANGES_PENDING', 'DEPLOYING'] as const) {
      rerender(<AddonsSection environmentStatus={environmentStatus} addons={addons(true)} />)
    }
    expect(success).not.toHaveBeenCalled()
    rerender(<AddonsSection environmentStatus="READY" addons={addons(true)} />)
    await waitFor(() => expect(success).toHaveBeenCalledWith('Workflows enabled'))
    success.mockRestore()
  })
})
