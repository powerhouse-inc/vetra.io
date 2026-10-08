import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const addTemplate = vi.fn()
const issueGrant = vi.fn()
const publishTerm = vi.fn()
const setInviteCodeActive = vi.fn()

vi.mock('../graphql', async (orig) => ({
  ...(await orig<typeof import('../graphql')>()),
  addTemplate: (...a: unknown[]) => addTemplate(...a),
  issueGrant: (...a: unknown[]) => issueGrant(...a),
  publishTerm: (...a: unknown[]) => publishTerm(...a),
  setInviteCodeActive: (...a: unknown[]) => setInviteCodeActive(...a),
}))
vi.mock('../hooks/use-publisher', () => ({ usePublisherToken: () => async () => 'tok' }))

import {
  useAddTemplate,
  useIssueGrant,
  usePublishTerm,
  useSetInviteCodeActive,
} from '../hooks/use-publisher-mutations'

function setup() {
  const qc = new QueryClient()
  const invalidate = vi.spyOn(qc, 'invalidateQueries')
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const invalidated = () =>
    invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey)
  return { Wrapper, invalidated }
}

describe('publisher mutation hooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('binds the appId into the input and refreshes templates', async () => {
    addTemplate.mockResolvedValue('tpl-1')
    const { Wrapper, invalidated } = setup()
    const { result } = renderHook(() => useAddTemplate('app-1'), { wrapper: Wrapper })
    let id: string | undefined
    await act(async () => {
      id = await result.current.mutateAsync({ name: 'Free', mode: 'SHARED' })
    })
    expect(id).toBe('tpl-1')
    expect(addTemplate).toHaveBeenCalledWith(
      { appId: 'app-1', name: 'Free', mode: 'SHARED' },
      'tok',
    )
    expect(invalidated()).toEqual([['publisher', 'templates', 'app-1']])
  })

  it('a grant refreshes licences, environments, plan counts and template counts', async () => {
    issueGrant.mockResolvedValue('lic-1')
    const { Wrapper, invalidated } = setup()
    const { result } = renderHook(() => useIssueGrant('app-1'), { wrapper: Wrapper })
    await act(async () => {
      await result.current.mutateAsync({ kind: 'pro', user: '0xabc', label: null })
    })
    expect(issueGrant).toHaveBeenCalledWith(
      { appId: 'app-1', kind: 'pro', user: '0xabc', label: null },
      'tok',
    )
    expect(invalidated()).toEqual([
      ['publisher', 'licenses', 'app-1'],
      ['publisher', 'environments', 'app-1'],
      ['publisher', 'terms', 'app-1'],
      ['publisher', 'templates', 'app-1'],
    ])
  })

  it('argument mutations get the appId as a bare argument', async () => {
    publishTerm.mockResolvedValue(true)
    setInviteCodeActive.mockResolvedValue(true)
    const { Wrapper } = setup()
    const pub = renderHook(() => usePublishTerm('app-1'), { wrapper: Wrapper })
    const act1 = renderHook(() => useSetInviteCodeActive('app-1'), { wrapper: Wrapper })
    await act(async () => {
      await pub.result.current.mutateAsync({ termId: 't1' })
      await act1.result.current.mutateAsync({ code: 'C', active: false })
    })
    expect(publishTerm).toHaveBeenCalledWith({ appId: 'app-1', termId: 't1' }, 'tok')
    expect(setInviteCodeActive).toHaveBeenCalledWith(
      { appId: 'app-1', code: 'C', active: false },
      'tok',
    )
  })

  it('never retries a failed write', async () => {
    issueGrant.mockRejectedValue(new Error('nope'))
    const { Wrapper } = setup()
    const { result } = renderHook(() => useIssueGrant('app-1'), { wrapper: Wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync({ kind: 'pro', user: '0xabc' })).rejects.toThrow(
        'nope',
      )
    })
    expect(issueGrant).toHaveBeenCalledTimes(1)
  })
})
