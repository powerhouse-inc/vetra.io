import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { AppsApiError } from '@/modules/apps/graphql'

const push = vi.hoisted(() => vi.fn())
const mutateAsync = vi.hoisted(() => vi.fn())
const org = vi.hoisted(() => ({ orgId: null as string | null, org: null as unknown }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/modules/apps/hooks/use-apps', () => ({
  useCreateStudioApp: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useActiveOrg: () => ({ orgId: org.orgId, org: org.org }),
}))

import { MakeAppDialog } from '../make-app-dialog'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  org.orgId = null
  org.org = null
})

function open() {
  render(<MakeAppDialog studioEnvironmentId="env-1" label="My Shop" />)
  fireEvent.click(screen.getByRole('button', { name: 'Make it an App' }))
}

describe('MakeAppDialog', () => {
  it('creates the App from the Studio and opens its page', async () => {
    mutateAsync.mockResolvedValue({ id: 'a1' })
    open()
    expect(screen.getByText(/Creates a private GitHub repository for this Studio/)).toBeTruthy()
    expect((screen.getByLabelText('App name') as HTMLInputElement).value).toBe('My Shop')
    fireEvent.click(screen.getByRole('button', { name: 'Create App' }))
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'My Shop',
        studioEnvironmentId: 'env-1',
        orgId: null,
      }),
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith('/user/apps/a1'))
  })

  it('creates in the active organisation', async () => {
    org.orgId = 'o1'
    org.org = { id: 'o1', name: 'Acme', role: 'ADMIN' }
    mutateAsync.mockResolvedValue({ id: 'a1' })
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Create App' }))
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'o1' })),
    )
  })

  it('shows the backend refusal', async () => {
    mutateAsync.mockRejectedValue(
      new AppsApiError('BAD_USER_INPUT', 'This Studio is already an App'),
    )
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Create App' }))
    expect(await screen.findByText('This Studio is already an App')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })

  it('keeps the backend wording when the Studio is not yours', async () => {
    mutateAsync.mockRejectedValue(new AppsApiError('FORBIDDEN', 'You do not own this Studio'))
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Create App' }))
    expect(await screen.findByText('You do not own this Studio')).toBeTruthy()
  })

  it('blocks org members from creating', () => {
    org.orgId = 'o1'
    org.org = { id: 'o1', name: 'Acme', role: 'MEMBER' }
    open()
    expect(screen.getByRole('alert').textContent).toContain('Ask an owner or admin of Acme')
    const submit = screen.getByRole('button', { name: 'Create App' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.click(submit)
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
