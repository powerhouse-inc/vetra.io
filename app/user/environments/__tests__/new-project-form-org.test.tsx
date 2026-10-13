import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EnvironmentHandOverError } from '@/modules/cloud/org-sync'

const push = vi.fn()
const createEnv = vi.fn<(input: { orgId?: string | null }) => Promise<{ documentId: string }>>()
const toastError = vi.fn<(...a: unknown[]) => void>()
let role = 'PUBLISHER'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }))
vi.mock('@/modules/cloud/components/require-signer', () => ({
  RequireSigner: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/modules/cloud/hooks/use-can-sign', () => ({
  useCanSign: () => ({ canSign: true, signer: { user: { address: '0xme' } }, loading: false }),
}))
vi.mock('@/modules/cloud/hooks/use-create-environment', () => ({
  useCreateEnvironment: () => createEnv,
}))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useActiveOrg: () => ({
    orgId: 'o1',
    org: { id: 'o1', name: 'Acme', role },
    orgs: [],
    isLoading: false,
    setActiveOrg: vi.fn(),
  }),
}))

import { NewEnvironmentForm } from '@/app/user/environments/new-project-form'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  role = 'PUBLISHER'
})

function submit(name = 'Shop') {
  fireEvent.change(screen.getByPlaceholderText('Enter environment name'), {
    target: { value: name },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create Environment' }))
}

describe('NewEnvironmentForm in an organisation', () => {
  it('creates in the active organisation', async () => {
    createEnv.mockResolvedValue({ documentId: 'e1' })
    const onCreated = vi.fn()
    render(<NewEnvironmentForm onCreated={onCreated} />)
    expect(screen.getByText('It will belong to Acme.')).toBeTruthy()
    submit()
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('e1'))
    expect(createEnv.mock.calls[0][0].orgId).toBe('o1')
  })

  it('refuses members of the organisation', () => {
    role = 'MEMBER'
    render(<NewEnvironmentForm />)
    expect(screen.getByText(/Members of Acme cannot create environments/)).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Create Environment' }).disabled,
    ).toBe(true)
  })

  it('keeps a failed hand-over visible after navigation, with a way to retry', async () => {
    createEnv.mockRejectedValue(new EnvironmentHandOverError('e9', 'FORBIDDEN'))
    const onCreated = vi.fn()
    render(<NewEnvironmentForm onCreated={onCreated} />)
    submit()
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('e9'))
    expect(toastError).toHaveBeenCalledTimes(1)
    const [message, opts] = toastError.mock.calls[0] as [
      string,
      { duration: number; action: { label: string; onClick: () => void } },
    ]
    expect(message).toMatch(/^Your environment was created but could not be moved to Acme: /)
    expect(message).toMatch(/Try again from Settings\.$/)
    expect(opts.duration).toBe(Infinity)
    opts.action.onClick()
    expect(push).toHaveBeenCalledWith('/user/environments/e9?settings=organisation')
  })
})
