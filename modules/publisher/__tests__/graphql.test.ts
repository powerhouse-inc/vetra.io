import { describe, it, expect, vi } from 'vitest'
import {
  publisherGql,
  toPublisherError,
  describePublisherError,
  isPublisherError,
  PublisherApiError,
  type FetchLike,
} from '../graphql'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('publisherGql', () => {
  it('sends the bearer token when there is one', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { ok: 1 } })) as unknown as FetchLike
    await publisherGql('{ ok }', undefined, 'tok-1', fetchImpl)
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(init.headers.Authorization).toBe('Bearer tok-1')
  })

  it('omits Authorization when the token is null', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { ok: 1 } })) as unknown as FetchLike
    await publisherGql('{ ok }', undefined, null, fetchImpl)
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('maps a server error code onto PublisherApiError', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ errors: [{ message: 'no such app', extensions: { code: 'UNKNOWN_APP' } }] }),
    ) as unknown as FetchLike
    const err = await publisherGql('{ ok }', undefined, 't', fetchImpl).catch((e) => e)
    expect(isPublisherError(err, 'UNKNOWN_APP')).toBe(true)
    expect((err as PublisherApiError).message).toBe('no such app')
  })

  it('turns a thrown fetch into NETWORK', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as FetchLike
    const err = await publisherGql('{ ok }', undefined, 't', fetchImpl).catch((e) => e)
    expect(isPublisherError(err, 'NETWORK')).toBe(true)
  })

  it('maps a schema mismatch to PUBLISHER_UNAVAILABLE', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        errors: [{ message: 'Cannot query field "vetraPublisher" on type "Query".' }],
      }),
    ) as unknown as FetchLike
    const err = await publisherGql('{ ok }', undefined, 't', fetchImpl).catch((e) => e)
    expect(isPublisherError(err, 'PUBLISHER_UNAVAILABLE')).toBe(true)
  })
})

describe('toPublisherError', () => {
  it('passes every code the server can send through unchanged', () => {
    for (const code of [
      'UNAUTHENTICATED',
      'UNKNOWN_APP',
      'APP_IDENTITY_INACTIVE',
      'LICENSING_DISABLED',
      'UNKNOWN_LICENSE_TYPE',
      'UNKNOWN_LICENSE',
      'INVALID_INPUT',
      'NOT_ON_ALLOW_LIST',
    ]) {
      expect(toPublisherError({ message: 'x', extensions: { code } }, 200).code).toBe(code)
    }
  })

  it('maps an unrecognised code to UNKNOWN', () => {
    expect(
      toPublisherError({ message: 'x', extensions: { code: 'INTERNAL_SERVER_ERROR' } }, 200).code,
    ).toBe('UNKNOWN')
  })
})

describe('describePublisherError', () => {
  it('returns the SERVER message verbatim for every server-controlled code', () => {
    // The spec requires backend error text be surfaced verbatim; the UI invents
    // no error copy of its own. Canned copy here would hide, for example, which
    // licence type a tier mutation rejected.
    for (const code of [
      'UNAUTHENTICATED',
      'UNKNOWN_APP',
      'APP_IDENTITY_INACTIVE',
      'LICENSING_DISABLED',
      'UNKNOWN_LICENSE_TYPE',
      'UNKNOWN_LICENSE',
      'INVALID_INPUT',
      'NOT_ON_ALLOW_LIST',
      'UNKNOWN',
    ] as const) {
      const err = new PublisherApiError(code, 'the exact server text', null)
      expect(describePublisherError(err)).toBe('the exact server text')
    }
  })

  it('supplies copy only for the two codes the server never sends', () => {
    expect(describePublisherError(new PublisherApiError('NETWORK', 'fetch failed', null))).toMatch(
      /connection/i,
    )
    expect(
      describePublisherError(new PublisherApiError('PUBLISHER_UNAVAILABLE', 'x', null)),
    ).toMatch(/not available/i)
  })

  it('falls back to the message for a non-PublisherApiError', () => {
    expect(describePublisherError(new Error('plain'))).toBe('plain')
  })
})
