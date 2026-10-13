import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { EnvironmentSummary } from '@/modules/cloud/graphql'

vi.mock('@powerhousedao/reactor-browser', () => ({
  useDid: () => 'did:pkh:me',
  useRenown: () => null,
}))

const pending = new Map<string, (envs: EnvironmentSummary[]) => void>()
vi.mock('@/modules/cloud/graphql', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/cloud/graphql')>()),
  getAuthToken: () => Promise.resolve('tok'),
  fetchMyEnvironments: (scope: string, _token: unknown, orgId?: string | null) =>
    new Promise<EnvironmentSummary[]>((resolve) => pending.set(`${scope}:${orgId ?? ''}`, resolve)),
}))

import { useEnvironments, type ViewScope } from '@/modules/cloud/hooks/use-environment'

function env(id: string, owner: string): EnvironmentSummary {
  return { id, name: id, owner, createdBy: owner } as EnvironmentSummary
}

afterEach(() => {
  cleanup()
  pending.clear()
})

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(
    ({ scope, orgId }: { scope: ViewScope; orgId: string | null }) =>
      useEnvironments(scope, '0xme', { orgId }),
    { wrapper, initialProps: { scope: 'MINE' as ViewScope, orgId: null as string | null } },
  )
}

describe('env list across a context switch', () => {
  it('never shows the previous context’s envs after switching organisation', async () => {
    const hook = setup()
    await waitFor(() => expect(pending.has('MINE:')).toBe(true))
    pending.get('MINE:')!([env('personal-1', '0xme')])
    await waitFor(() => expect(hook.result.current.environments).toHaveLength(1))

    hook.rerender({ scope: 'MINE', orgId: 'org-acme' })
    expect(hook.result.current.environments).toStrictEqual([])
    expect(hook.result.current.isPending).toBe(true)
    await waitFor(() => expect(pending.has('ORG:org-acme')).toBe(true))
    pending.get('ORG:org-acme')!([env('acme-1', '0xother')])
    await waitFor(() =>
      expect(hook.result.current.environments.map((e) => e.id)).toStrictEqual(['acme-1']),
    )

    // org → personal
    hook.rerender({ scope: 'MINE', orgId: null })
    expect(hook.result.current.environments.map((e) => e.id)).not.toContain('acme-1')

    // org → another org
    hook.rerender({ scope: 'MINE', orgId: 'org-acme' })
    await waitFor(() => expect(hook.result.current.environments).toHaveLength(1))
    hook.rerender({ scope: 'MINE', orgId: 'org-beta' })
    expect(hook.result.current.environments).toStrictEqual([])
    expect(hook.result.current.isPending).toBe(true)
  })

  it('keeps the previous list while toggling MINE/ALL in the same context', async () => {
    const hook = setup()
    await waitFor(() => expect(pending.has('MINE:')).toBe(true))
    pending.get('MINE:')!([env('personal-1', '0xme')])
    await waitFor(() => expect(hook.result.current.environments).toHaveLength(1))

    hook.rerender({ scope: 'ALL', orgId: null })
    expect(hook.result.current.environments.map((e) => e.id)).toStrictEqual(['personal-1'])
    expect(hook.result.current.isPending).toBe(false)
  })
})
