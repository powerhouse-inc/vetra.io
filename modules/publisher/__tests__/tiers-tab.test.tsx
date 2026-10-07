import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import React from 'react'

const publish = vi.fn()
const retire = vi.fn()
const create = vi.fn()
const setDetails = vi.fn()
const setTemplate = vi.fn()
const addService = vi.fn()
const addPackage = vi.fn()
const toastError = vi.fn()
const toastSuccess = vi.fn()
let types: unknown[] = []

vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}))
vi.mock('../hooks/use-publisher', () => ({
  usePublisherLicenseTypes: () => ({ data: types, isPending: false, error: null }),
}))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useCreateLicenseType: () => ({ mutateAsync: create, isPending: false }),
  useSetLicenseTypeDetails: () => ({ mutateAsync: setDetails, isPending: false }),
  useSetLicenseTypeTemplate: () => ({ mutateAsync: setTemplate, isPending: false }),
  useAddLicenseTypeService: () => ({ mutateAsync: addService, isPending: false }),
  useAddLicenseTypePackage: () => ({ mutateAsync: addPackage, isPending: false }),
  usePublishLicenseType: () => ({ mutateAsync: publish, isPending: false }),
  useRetireLicenseType: () => ({ mutateAsync: retire, isPending: false }),
}))
vi.mock('@/shared/components/ui/select', () => ({
  // Native stand-in: Radix Select is not drivable in jsdom. Keeps value/onValueChange wiring real.
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange: (v: string) => void
    children: React.ReactNode
  }) => (
    <select
      aria-label="Service type"
      value={value ?? ''}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

import { TiersTab } from '../components/tiers-tab'

const tier = (over: Record<string, unknown> = {}) => ({
  id: 'lt-1',
  kind: 'PRO',
  label: 'Pro',
  status: 'DRAFT',
  validityDays: 365,
  templateHash: 'h',
  size: null,
  baseDomain: null,
  packageRegistry: null,
  services: [],
  packages: [],
  ...over,
})

beforeEach(() => {
  cleanup()
  types = []
  for (const m of [
    publish,
    retire,
    create,
    setDetails,
    setTemplate,
    addService,
    addPackage,
    toastError,
    toastSuccess,
  ])
    m.mockReset()
})

const openEdit = () => fireEvent.click(screen.getByRole('button', { name: /edit/i }))

describe('TiersTab', () => {
  it('says tiers are append-only where a publisher would otherwise be surprised', () => {
    types = [tier()]
    render(<TiersTab appId="a1" />)
    expect(screen.getByText(/cannot be removed/i)).toBeTruthy()
  })

  it('lists CLINT but marks it as not provisionable', () => {
    types = [tier()]
    render(<TiersTab appId="a1" />)
    expect(screen.getByText(/CLINT/)).toBeTruthy()
    expect(screen.getByText(/not provisionable/i)).toBeTruthy()
  })

  it('warns that retiring does NOT end service for existing holders', () => {
    types = [tier({ status: 'ACTIVE' })]
    render(<TiersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /retire/i }))
    expect(screen.getByText(/existing holders keep/i)).toBeTruthy()
  })

  it('warns that publishing a RETIRED tier reactivates it', () => {
    types = [tier({ status: 'RETIRED' })]
    render(<TiersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /publish/i }))
    expect(screen.getByText(/reactivate/i)).toBeTruthy()
  })

  it('renders an empty state when the app has no tiers', () => {
    types = []
    render(<TiersTab appId="a1" />)
    expect(screen.getByText(/no tiers/i)).toBeTruthy()
  })

  it('does NOT claim reactivation when publishing a DRAFT tier', () => {
    // The warning must be conditional on RETIRED, not shown on every publish.
    types = [tier({ status: 'DRAFT' })]
    render(<TiersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /publish/i }))
    expect(screen.queryByText(/reactivate/i)).toBeNull()
  })

  it('offers only the actions that fit each tier status, across several tiers', () => {
    types = [
      tier({ id: 'd', label: 'Draft one', status: 'DRAFT' }),
      tier({ id: 'a', label: 'Active one', status: 'ACTIVE' }),
      tier({ id: 'r', label: 'Retired one', status: 'RETIRED' }),
    ]
    render(<TiersTab appId="a1" />)
    const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
    expect(within(row('Draft one')).queryByRole('button', { name: /^publish$/i })).toBeTruthy()
    expect(within(row('Draft one')).queryByRole('button', { name: /^retire$/i })).toBeNull()
    expect(within(row('Active one')).queryByRole('button', { name: /^retire$/i })).toBeTruthy()
    expect(within(row('Active one')).queryByRole('button', { name: /^publish$/i })).toBeNull()
    expect(within(row('Retired one')).queryByRole('button', { name: /^publish$/i })).toBeTruthy()
    expect(within(row('Retired one')).queryByRole('button', { name: /^retire$/i })).toBeNull()
  })

  it('retire confirmation retires THAT tier, not another', async () => {
    retire.mockResolvedValue(true)
    types = [
      tier({ id: 'x', label: 'Other', status: 'DRAFT' }),
      tier({ id: 'lt-9', label: 'Target', status: 'ACTIVE' }),
    ]
    render(<TiersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /^retire$/i }))
    fireEvent.click(screen.getByRole('button', { name: /retire tier/i }))
    await waitFor(() => expect(retire).toHaveBeenCalledWith('lt-9'))
    expect(publish).not.toHaveBeenCalled()
  })

  it('cancelling the retire confirmation retires nothing', () => {
    types = [tier({ status: 'ACTIVE' })]
    render(<TiersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /^retire$/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(retire).not.toHaveBeenCalled()
  })

  it('publish confirmation publishes that tier', async () => {
    publish.mockResolvedValue(true)
    types = [tier({ id: 'lt-7', status: 'DRAFT' })]
    render(<TiersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))
    fireEvent.click(screen.getByRole('button', { name: /publish tier/i }))
    await waitFor(() => expect(publish).toHaveBeenCalledWith('lt-7'))
  })

  it('shows the server sentence verbatim when publish is refused, and does not claim success', async () => {
    const msg = 'PUBLISH_LICENSE_TYPE rejected: a license type needs at least one service'
    publish.mockRejectedValue(new Error(msg))
    types = [tier({ status: 'DRAFT' })]
    render(<TiersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))
    fireEvent.click(screen.getByRole('button', { name: /publish tier/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(msg))
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('with licensing disabled the list still renders and the refusal is shown verbatim', async () => {
    const msg = 'Licensing is disabled on this deployment'
    retire.mockRejectedValue(new Error(msg))
    types = [tier({ status: 'ACTIVE', label: 'Still listed' })]
    render(<TiersTab appId="a1" />)
    expect(screen.getByText('Still listed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^retire$/i }))
    fireEvent.click(screen.getByRole('button', { name: /retire tier/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(msg))
  })

  it('create dialog submits the new tier for THIS app', async () => {
    create.mockResolvedValue('lt-new')
    render(<TiersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /new tier/i }))
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'TEAM' } })
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Team' } })
    fireEvent.change(screen.getByLabelText(/validity/i), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: /create tier/i }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        appId: 'a1',
        kind: 'TEAM',
        label: 'Team',
        validityDays: 30,
      }),
    )
  })

  it('create dialog shows a server refusal verbatim', async () => {
    create.mockRejectedValue(new Error('kind already exists'))
    render(<TiersTab appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: /new tier/i }))
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'TEAM' } })
    fireEvent.click(screen.getByRole('button', { name: /create tier/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('kind already exists'))
  })
})

describe('per-row CLINT flag', () => {
  it('flags a CLINT service on its own row and not on rows without one', () => {
    types = [
      tier({ id: 'c', label: 'Has clint', services: [{ id: 's1', type: 'CLINT', prefix: null }] }),
      tier({ id: 'n', label: 'No clint', services: [{ id: 's2', type: 'CONNECT', prefix: null }] }),
    ]
    render(<TiersTab appId="a1" />)
    const row = (n: string) => screen.getByText(n).closest('tr') as HTMLElement
    expect(within(row('Has clint')).getByText(/CLINT \(not provisionable\)/)).toBeTruthy()
    expect(within(row('No clint')).queryByText(/not provisionable/i)).toBeNull()
  })
})

describe('TierDetail', () => {
  it('repeats the append-only warning beside BOTH the service and the package forms', () => {
    types = [tier()]
    render(<TiersTab appId="a1" />)
    openEdit()
    // one in the tab note + one under services + one under packages
    expect(screen.getAllByText(/cannot be removed/i).length).toBe(3)
  })

  // TemplateServiceType in the app-license-type document model. A value outside this set
  // is refused by the reducer with a raw schema error, so offering one is a defect.
  const MODEL_SERVICE_TYPES = ['CONNECT', 'SWITCHBOARD', 'CLINT']

  it('offers exactly the service types the licence model accepts', () => {
    types = [tier()]
    render(<TiersTab appId="a1" />)
    openEdit()
    const select = screen.getByLabelText('Service type') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(MODEL_SERVICE_TYPES)
  })

  it('lists CLINT in the service select, flagged, and blocks adding it', () => {
    types = [tier()]
    render(<TiersTab appId="a1" />)
    openEdit()
    const select = screen.getByLabelText('Service type') as HTMLSelectElement
    const labels = Array.from(select.options).map((o) => o.textContent)
    expect(labels).toEqual(['CONNECT', 'SWITCHBOARD', 'CLINT — not provisionable yet'])
    const add = screen.getByRole('button', { name: /add service/i }) as HTMLButtonElement
    expect(add.disabled).toBe(false)
    fireEvent.change(select, { target: { value: 'CLINT' } })
    expect(add.disabled).toBe(true)
    fireEvent.click(add)
    expect(addService).not.toHaveBeenCalled()
    fireEvent.change(select, { target: { value: 'SWITCHBOARD' } })
    expect(add.disabled).toBe(false)
  })

  it('adds the chosen service type with its prefix to THIS tier', async () => {
    addService.mockResolvedValue(true)
    types = [tier({ id: 'lt-3' })]
    render(<TiersTab appId="a1" />)
    openEdit()
    fireEvent.change(screen.getByLabelText('Service type'), { target: { value: 'SWITCHBOARD' } })
    fireEvent.change(screen.getByLabelText(/prefix/i), { target: { value: 'api' } })
    fireEvent.click(screen.getByRole('button', { name: /add service/i }))
    await waitFor(() =>
      expect(addService).toHaveBeenCalledWith({
        licenseTypeId: 'lt-3',
        type: 'SWITCHBOARD',
        prefix: 'api',
      }),
    )
  })

  it('shows an add-service refusal verbatim', async () => {
    addService.mockRejectedValue(new Error('tier is not editable'))
    types = [tier()]
    render(<TiersTab appId="a1" />)
    openEdit()
    fireEvent.click(screen.getByRole('button', { name: /add service/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('tier is not editable'))
  })

  it('adds a package and shows the reducer sentence verbatim on a duplicate', async () => {
    const msg = 'Package @acme/x is already in this template'
    addPackage.mockRejectedValue(new Error(msg))
    types = [tier({ id: 'lt-4' })]
    render(<TiersTab appId="a1" />)
    openEdit()
    fireEvent.change(screen.getByLabelText(/package name/i), { target: { value: '@acme/x' } })
    fireEvent.change(screen.getByLabelText(/version/i), { target: { value: '1.2.3' } })
    fireEvent.click(screen.getByRole('button', { name: /add package/i }))
    await waitFor(() =>
      expect(addPackage).toHaveBeenCalledWith({
        licenseTypeId: 'lt-4',
        packageName: '@acme/x',
        version: '1.2.3',
      }),
    )
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(msg))
  })

  it('saves only the details that changed (omitted key = leave unchanged)', async () => {
    setDetails.mockResolvedValue(true)
    types = [tier({ id: 'lt-5' })]
    render(<TiersTab appId="a1" />)
    openEdit()
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Pro Plus' } })
    fireEvent.click(screen.getByRole('button', { name: /save details/i }))
    await waitFor(() =>
      expect(setDetails).toHaveBeenCalledWith({ licenseTypeId: 'lt-5', label: 'Pro Plus' }),
    )
  })

  it('clearing the label is blocked, explained, and never reports a false success', () => {
    types = [tier({ id: 'lt-5', label: 'Pro' })]
    render(<TiersTab appId="a1" />)
    openEdit()
    expect(screen.getByText(/replaced but not cleared/i)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: '' } })
    const save = screen.getByRole('button', { name: /save details/i }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(save)
    expect(setDetails).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
    // replacing it is fine
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Pro 2' } })
    expect(save.disabled).toBe(false)
  })

  it('Save details is disabled when nothing changed (no no-op success)', () => {
    types = [tier()]
    render(<TiersTab appId="a1" />)
    openEdit()
    expect(
      (screen.getByRole('button', { name: /save details/i }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('clearing validity sends null, not an omitted key', async () => {
    setDetails.mockResolvedValue(true)
    types = [tier({ id: 'lt-5' })]
    render(<TiersTab appId="a1" />)
    openEdit()
    fireEvent.change(screen.getByLabelText(/validity/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save details/i }))
    await waitFor(() =>
      expect(setDetails).toHaveBeenCalledWith({ licenseTypeId: 'lt-5', validityDays: null }),
    )
  })

  const fullTemplate = {
    size: 'M',
    baseDomain: 'example.org',
    packageRegistry: 'https://reg.example.org',
  }

  it('prefills the template inputs from the tier', () => {
    types = [tier({ id: 'lt-6', ...fullTemplate })]
    render(<TiersTab appId="a1" />)
    openEdit()
    expect((screen.getByLabelText('Size') as HTMLInputElement).value).toBe('M')
    expect((screen.getByLabelText(/base domain/i) as HTMLInputElement).value).toBe('example.org')
    expect((screen.getByLabelText(/package registry/i) as HTMLInputElement).value).toBe(
      'https://reg.example.org',
    )
  })

  it('editing ONE template field sends the other two with their ORIGINAL values (SET_TEMPLATE is a full replace)', async () => {
    setTemplate.mockResolvedValue(true)
    types = [tier({ id: 'lt-6', ...fullTemplate })]
    render(<TiersTab appId="a1" />)
    openEdit()
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'L' } })
    fireEvent.click(screen.getByRole('button', { name: /save template/i }))
    await waitFor(() => expect(setTemplate).toHaveBeenCalledTimes(1))
    expect(setTemplate.mock.calls[0][0]).toEqual({
      licenseTypeId: 'lt-6',
      size: 'L',
      baseDomain: 'example.org',
      packageRegistry: 'https://reg.example.org',
    })
  })

  it('clearing a template field sends an explicit null, not an omitted key', async () => {
    setTemplate.mockResolvedValue(true)
    types = [tier({ id: 'lt-6', ...fullTemplate })]
    render(<TiersTab appId="a1" />)
    openEdit()
    fireEvent.change(screen.getByLabelText(/base domain/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save template/i }))
    await waitFor(() => expect(setTemplate).toHaveBeenCalledTimes(1))
    const sent = setTemplate.mock.calls[0][0]
    expect(sent).toHaveProperty('baseDomain', null)
    expect(sent).toEqual({
      licenseTypeId: 'lt-6',
      size: 'M',
      baseDomain: null,
      packageRegistry: 'https://reg.example.org',
    })
  })

  it('does not tell the publisher an empty field keeps its value', () => {
    types = [tier()]
    render(<TiersTab appId="a1" />)
    openEdit()
    expect(screen.queryByText(/keep its current value/i)).toBeNull()
    expect(screen.getByText(/replaces all three/i)).toBeTruthy()
  })
})
