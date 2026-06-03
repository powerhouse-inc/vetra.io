import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchLogs } from '@/modules/cloud/graphql'

type Captured = { query: string; variables: Record<string, unknown> }

function mockFetch(): () => Captured {
  let captured: Captured = { query: '', variables: {} }
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      captured = JSON.parse(init.body as string) as Captured
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { logs: [{ timestamp: 1, line: 'hello' }] } }),
      } as Response)
    }),
  )
  return () => captured
}

describe('fetchLogs', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('passes the agent prefix to the logs query', async () => {
    const get = mockFetch()
    await fetchLogs('sub', 'tenant-1', null, 'FIVE_MIN', 500, false, 'tok', 'vetra-agent-5')
    const { query, variables } = get()
    expect(query).toContain('agent: $agent')
    expect(variables.agent).toBe('vetra-agent-5')
    expect(variables.service).toBeNull()
  })

  it('sends a null agent when none is given (env-wide / service-scoped calls)', async () => {
    const get = mockFetch()
    await fetchLogs('sub', 'tenant-1', 'SWITCHBOARD', 'FIVE_MIN', 500, false, 'tok')
    const { variables } = get()
    expect(variables.agent).toBeNull()
    expect(variables.service).toBe('SWITCHBOARD')
  })
})
