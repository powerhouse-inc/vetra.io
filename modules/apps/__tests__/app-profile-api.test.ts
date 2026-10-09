import { describe, expect, it } from 'vitest'
import {
  describePublisherError,
  fetchPublisherApps,
  PublisherApiError,
  toPublisherError,
  updateAppProfile,
  type FetchLike,
} from '@/modules/publisher/graphql'

const capture = (body: unknown, status = 200) => {
  const calls: Array<{ query: string; variables: Record<string, unknown> }> = []
  const fetchImpl: FetchLike = async (_url, init) => {
    calls.push(
      JSON.parse(init.body as string) as { query: string; variables: Record<string, unknown> },
    )
    return new Response(JSON.stringify(body), { status })
  }
  return { calls, fetchImpl }
}

describe('app profile writes through vetraPublisher', () => {
  it('sends updateAppProfile with the input untouched', async () => {
    const { calls, fetchImpl } = capture({ data: { vetraPublisher: { updateAppProfile: true } } })
    const input = {
      appId: 'app-1',
      tagline: '',
      links: [{ id: 'l1', label: 'Docs', url: 'https://docs.example' }],
    }
    expect(await updateAppProfile(input, 't', fetchImpl)).toBe(true)
    expect(calls[0]?.query).toContain('mutation ($input: UpdateAppProfileInput!)')
    expect(calls[0]?.query).toContain('updateAppProfile(input: $input)')
    expect(calls[0]?.variables).toEqual({ input })
  })

  it('keeps the field a refusal names, and knows the profile codes', async () => {
    const { fetchImpl } = capture({
      data: null,
      errors: [
        {
          message: 'Description must be at most 2000 characters',
          extensions: { code: 'INVALID_INPUT', field: 'description' },
        },
      ],
    })
    const error = await updateAppProfile(
      { appId: 'app-1', description: 'x' },
      't',
      fetchImpl,
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PublisherApiError)
    expect(error).toMatchObject({ code: 'INVALID_INPUT', field: 'description' })
    for (const code of ['NO_IDENTITY', 'RATE_LIMITED', 'PROFILE_UNAVAILABLE'] as const) {
      const mapped = toPublisherError({ message: 'm', extensions: { code } }, 200)
      expect(mapped.code).toBe(code)
      expect(mapped.field).toBeNull()
      expect(describePublisherError(mapped)).not.toBe('m')
    }
  })

  it('asks myApps for the identity DID', async () => {
    const { calls, fetchImpl } = capture({ data: { vetraPublisher: { myApps: [] } } })
    await fetchPublisherApps('t', fetchImpl)
    expect(calls[0]?.query).toContain('identityDid')
  })
})
