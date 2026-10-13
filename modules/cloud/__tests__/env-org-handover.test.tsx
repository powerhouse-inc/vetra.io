import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const handOverToOrg = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve())
vi.mock('@/modules/cloud/org-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/cloud/org-sync')>()),
  handOverToOrg: (...args: unknown[]) => handOverToOrg(...args),
}))
vi.mock('@/modules/cloud/client', () => ({ resolveAuthToken: () => Promise.resolve('tok') }))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useActiveOrg: () => ({
    orgId: null,
    org: null,
    orgs: [
      {
        id: 'o1',
        did: 'd1',
        handle: 'acme',
        name: 'Acme',
        avatar: null,
        verifiedDomains: [],
        role: 'PUBLISHER',
      },
    ],
    isLoading: false,
    setActiveOrg: vi.fn(),
  }),
}))

import { EnvOrgHandOver } from '@/modules/cloud/components/env-org-handover'

afterEach(() => {
  cleanup()
  handOverToOrg.mockClear()
})

function renderIt(props: Partial<Parameters<typeof EnvOrgHandOver>[0]> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <EnvOrgHandOver
        environmentId="e1"
        displayName="Shop"
        owner="0xme"
        ownerOrgId={null}
        status="READY"
        appLinked={false}
        viewerAddress="0xMe"
        {...props}
      />
    </QueryClientProvider>,
  )
}

describe('EnvOrgHandOver', () => {
  it('confirms a one-way move, then hands over through setEnvironmentOrg', async () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Move to Acme' }))
    expect(screen.getByText(/This is one-way/)).toBeTruthy()
    const buttons = screen.getAllByRole('button', { name: 'Move to Acme' })
    fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() =>
      expect(handOverToOrg).toHaveBeenCalledWith('e1', 'o1', 'tok', { attempts: 1 }),
    )
  })

  it('is hidden from anyone but the personal owner', () => {
    renderIt({ viewerAddress: '0xother' })
    expect(screen.queryByText('Move to an organisation')).toBeNull()
  })
})
