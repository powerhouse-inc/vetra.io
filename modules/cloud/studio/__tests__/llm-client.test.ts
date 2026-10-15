import { describe, it, expect } from 'vitest'
import { buildSchema, parse, validate } from 'graphql'
import type { FetchLike } from '@/modules/publisher/graphql'
import { fetchStudioLlmStatus, provisionStudioLlm } from '../llm-client'

// The vetraLlm SDL as served by vetra-cloud-package subgraphs/vetra-llm/schema.ts.
const schema = buildSchema(`
  type StudioLlmStatus { environmentId: String! connected: Boolean! }
  type StudioLlmProvision { environmentId: String! connected: Boolean! llmBudgetUsd: Float! }
  type VetraLlmQueries { studioLlmStatus(environmentId: String!): StudioLlmStatus! }
  type VetraLlmMutations { provisionStudioLlm(tenantId: String!): StudioLlmProvision! }
  type Query { vetraLlm: VetraLlmQueries! }
  type Mutation { vetraLlm: VetraLlmMutations! }
`)

const respond = (body: unknown) => {
  const calls: Array<{ query: string; variables: Record<string, unknown>; auth: string | null }> =
    []
  const fetchImpl: FetchLike = (_url, init) => {
    const sent = JSON.parse(init.body as string) as {
      query: string
      variables: Record<string, unknown>
    }
    calls.push({ ...sent, auth: (init.headers as Record<string, string>).Authorization ?? null })
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }
  return { calls, fetchImpl }
}

describe('llm-client', () => {
  it('provisions with the tenant id and a bearer, against the vetraLlm schema', async () => {
    const r = respond({
      data: {
        vetraLlm: {
          provisionStudioLlm: { environmentId: 'e1', connected: true, llmBudgetUsd: 20 },
        },
      },
    })
    await expect(provisionStudioLlm('t-1', 'tok', r.fetchImpl)).resolves.toEqual({
      environmentId: 'e1',
      connected: true,
      llmBudgetUsd: 20,
    })
    expect(r.calls[0].variables).toEqual({ tenantId: 't-1' })
    expect(r.calls[0].auth).toBe('Bearer tok')
    expect(validate(schema, parse(r.calls[0].query))).toEqual([])
  })

  it('treats an unconfigured broker as "no model yet", and rethrows anything else', async () => {
    const off = respond({
      errors: [
        { message: 'OpenRouter is not configured', extensions: { code: 'SERVICE_NOT_CONFIGURED' } },
      ],
    })
    await expect(provisionStudioLlm('t-1', 'tok', off.fetchImpl)).resolves.toBeNull()
    const denied = respond({ errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] })
    await expect(provisionStudioLlm('t-1', 'tok', denied.fetchImpl)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it.each(['BAD_USER_INPUT', 'INTERNAL', 'UPSTREAM_ERROR'])(
    'keeps the vetra-llm code %s (not UNKNOWN)',
    async (code) => {
      const r = respond({ errors: [{ message: 'x', extensions: { code } }] })
      await expect(fetchStudioLlmStatus('e1', 'tok', r.fetchImpl)).rejects.toMatchObject({ code })
    },
  )

  it('reads the status', async () => {
    const r = respond({
      data: { vetraLlm: { studioLlmStatus: { environmentId: 'e1', connected: false } } },
    })
    await expect(fetchStudioLlmStatus('e1', 'tok', r.fetchImpl)).resolves.toEqual({
      environmentId: 'e1',
      connected: false,
    })
    expect(validate(schema, parse(r.calls[0].query))).toEqual([])
  })
})
