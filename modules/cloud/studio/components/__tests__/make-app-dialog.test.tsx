import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { AppsApiError } from '@/modules/apps/graphql'

const push = vi.hoisted(() => vi.fn())
const mutateAsync = vi.hoisted(() => vi.fn())
const org = vi.hoisted(() => ({ orgId: null as string | null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/modules/apps/hooks/use-apps', () => ({
  useCreateStudioApp: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useActiveOrg: () => ({ orgId: org.orgId, org: null }),
}))

import { MakeAppDialog } from '../make-app-dialog'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  org.orgId = null
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
})
