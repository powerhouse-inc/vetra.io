import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { AppsApiError } from '@/modules/apps/graphql'

const push = vi.hoisted(() => vi.fn())
const mutateAsync = vi.hoisted(() => vi.fn())
const apps = vi.hoisted(() => ({
  data: [] as { id: string; studioEnvironmentId?: string | null }[],
}))
const appInfo = vi.hoisted(() => ({ error: null as unknown }))
const installs = vi.hoisted(() => ({
  data: [{ installationId: '11', accountLogin: 'alice', accountType: 'User' }] as {
    installationId: string
    accountLogin: string
    accountType: string
  }[],
  isPending: false,
  error: null as unknown,
}))
const org = vi.hoisted(() => ({ orgId: null as string | null, org: null as unknown }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/modules/apps/hooks/use-apps', () => ({
  useCreateStudioApp: () => ({ mutateAsync, isPending: false }),
  useMyApps: () => ({ data: apps.data }),
  useMyGithubDeployInstallations: () => installs,
  useGithubDeployAppInfo: () => ({
    data: { installUrl: 'https://gh/install', authorizeUrl: 'https://gh/auth' },
    error: appInfo.error,
  }),
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
  apps.data = []
  installs.data = [{ installationId: '11', accountLogin: 'alice', accountType: 'User' }]
  installs.isPending = false
  installs.error = null
  appInfo.error = null
})

function open() {
  render(<MakeAppDialog studioEnvironmentId="env-1" label="My Shop" />)
  fireEvent.click(screen.getByRole('button', { name: 'Make it an app' }))
}

describe('MakeAppDialog', () => {
  it('creates the App from the Studio and opens its page', async () => {
    mutateAsync.mockResolvedValue({ id: 'a1' })
    open()
    expect(
      screen.getByText(/Creates a private GitHub repository in alice for this Studio/),
    ).toBeTruthy()
    expect(screen.getByText(/It also creates the App's production environment\./)).toBeTruthy()
    expect((screen.getByLabelText('App name') as HTMLInputElement).value).toBe('My Shop')
    fireEvent.click(screen.getByRole('button', { name: 'Create App' }))
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'My Shop',
        studioEnvironmentId: 'env-1',
        installationId: '11',
        orgId: null,
      }),
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith('/user/apps/a1'))
  })

  it('offers an Open App link instead of the trigger when the Studio is already an App', () => {
    apps.data = [{ id: 'a9', studioEnvironmentId: 'env-1' }]
    render(<MakeAppDialog studioEnvironmentId="env-1" label="My Shop" />)
    expect(screen.queryByRole('button', { name: 'Make it an app' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Open App' }).getAttribute('href')).toBe(
      '/user/apps/a9',
    )
  })

  it('still offers the trigger when another Studio is the App', () => {
    apps.data = [{ id: 'a9', studioEnvironmentId: 'env-2' }]
    render(<MakeAppDialog studioEnvironmentId="env-1" label="My Shop" />)
    expect(screen.getByRole('button', { name: 'Make it an app' })).toBeTruthy()
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

  it('shows the connect flow and disables submit with no GitHub installation', () => {
    installs.data = []
    open()
    expect(screen.getByText('Install Vetra Deploy')).toBeTruthy()
    const submit = screen.getByRole('button', { name: 'Create App' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.click(submit)
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('sends the installation picked as repository owner', async () => {
    installs.data = [
      { installationId: '11', accountLogin: 'alice', accountType: 'User' },
      { installationId: '22', accountLogin: 'acme-inc', accountType: 'Organization' },
    ]
    mutateAsync.mockResolvedValue({ id: 'a1' })
    open()
    fireEvent.click(screen.getByRole('combobox', { name: 'Repository owner' }))
    fireEvent.click(await screen.findByRole('option', { name: /acme-inc/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create App' }))
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ installationId: '22' })),
    )
  })

  it('offers reconnect when GitHub is not connected', async () => {
    mutateAsync.mockRejectedValue(new AppsApiError('GITHUB_NOT_CONNECTED', 'x'))
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Create App' }))
    expect(await screen.findByText('Reconnect GitHub')).toBeTruthy()
  })

  it('shows an installations load error instead of the connect flow', () => {
    installs.data = []
    installs.error = new AppsApiError('NETWORK', 'boom')
    open()
    expect(screen.getByText(/Could not reach Vetra/)).toBeTruthy()
    expect(screen.queryByText('Install Vetra Deploy')).toBeNull()
    expect((screen.getByRole('button', { name: 'Create App' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('shows the app info error when there are no installations', () => {
    installs.data = []
    appInfo.error = new AppsApiError('BAD_USER_INPUT', 'GitHub app missing')
    open()
    expect(screen.getByText(/GitHub app missing/)).toBeTruthy()
    expect(screen.queryByText('Install Vetra Deploy')).toBeNull()
  })

  it('keeps the owner select and shows the error when a refetch fails', async () => {
    installs.data = [
      { installationId: '11', accountLogin: 'alice', accountType: 'User' },
      { installationId: '22', accountLogin: 'acme-inc', accountType: 'Organization' },
    ]
    installs.error = new AppsApiError('NETWORK', 'boom')
    mutateAsync.mockResolvedValue({ id: 'a1' })
    open()
    expect(screen.getByText(/Could not reach Vetra/)).toBeTruthy()
    fireEvent.click(screen.getByRole('combobox', { name: 'Repository owner' }))
    fireEvent.click(await screen.findByRole('option', { name: /acme-inc/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create App' }))
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ installationId: '22' })),
    )
  })
})
