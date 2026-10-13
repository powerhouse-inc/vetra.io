import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { MyOrg } from '../types'

vi.mock('@powerhousedao/reactor-browser', () => ({
  useDid: () => 'did:pkh:me',
  useRenown: () => null,
  useRenownAuthAsync: () => ({ state: 'authenticated', address: '0xme' }),
}))
vi.mock('@/modules/cloud/graphql', () => ({ getAuthToken: () => Promise.resolve('tok') }))

let answer: { orgs: MyOrg[]; partial: boolean } = { orgs: [], partial: false }
vi.mock('../graphql', () => ({
  fetchMyOrganizationsAnswer: () => Promise.resolve(answer),
  fetchOrganizationSummary: vi.fn(),
}))

import { ACTIVE_ORG_KEY, writeActiveOrg } from '../active-org'
import { useActiveOrg } from '../hooks/use-orgs'

const pub: MyOrg = {
  id: 'o-public',
  did: 'd',
  handle: 'pub',
  name: 'Pub',
  avatar: null,
  verifiedDomains: [],
  role: 'MEMBER',
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useActiveOrg(), { wrapper })
}

describe('active org after a degraded membership answer', () => {
  it('keeps a hidden-membership org stored when Renown refused the bearer', async () => {
    writeActiveOrg('o-hidden')
    answer = { orgs: [pub], partial: true }
    const hook = render()
    await waitFor(() => expect(hook.result.current.orgs).toHaveLength(1))
    expect(hook.result.current.orgId).toBeNull()
    expect(window.localStorage.getItem(ACTIVE_ORG_KEY)).toBe('o-hidden')
  })

  it('forgets the stored org on an authoritative answer without it', async () => {
    writeActiveOrg('o-gone')
    answer = { orgs: [pub], partial: false }
    const hook = render()
    await waitFor(() => expect(hook.result.current.orgs).toHaveLength(1))
    await waitFor(() => expect(window.localStorage.getItem(ACTIVE_ORG_KEY)).toBeNull())
  })
})
