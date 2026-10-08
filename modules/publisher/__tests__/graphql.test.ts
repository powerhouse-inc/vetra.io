import { describe, it, expect, vi } from 'vitest'
import {
  publisherGql,
  toPublisherError,
  describePublisherError,
  isPublisherError,
  PublisherApiError,
  retryPublisher,
  type FetchLike,
} from '../graphql'

const SERVER_CODES = [
  'UNAUTHENTICATED',
  'NOT_FOUND',
  'FORBIDDEN',
  'INVALID_INPUT',
  'APP_NOT_ACTIVE',
  'NOT_ON_ALLOW_LIST',
  'TERM_NOT_ISSUABLE',
  'UNSUPPORTED_DID',
  'LICENSING_DISABLED',
  'INVALID_CODE',
  'ALREADY_HOLDS',
] as const

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
      jsonResponse({ errors: [{ message: 'no such app', extensions: { code: 'NOT_FOUND' } }] }),
    ) as unknown as FetchLike
    const err = await publisherGql('{ ok }', undefined, 't', fetchImpl).catch(
      (e: unknown) => e as PublisherApiError,
    )
    expect(isPublisherError(err, 'NOT_FOUND')).toBe(true)
    expect((err as PublisherApiError).message).toBe('no such app')
  })

  it('turns a thrown fetch into NETWORK', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as FetchLike
    const err = await publisherGql('{ ok }', undefined, 't', fetchImpl).catch(
      (e: unknown) => e as PublisherApiError,
    )
    expect(isPublisherError(err, 'NETWORK')).toBe(true)
  })

  it('maps a schema mismatch to PUBLISHER_UNAVAILABLE', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        errors: [{ message: 'Cannot query field "vetraPublisher" on type "Query".' }],
      }),
    ) as unknown as FetchLike
    const err = await publisherGql('{ ok }', undefined, 't', fetchImpl).catch(
      (e: unknown) => e as PublisherApiError,
    )
    expect(isPublisherError(err, 'PUBLISHER_UNAVAILABLE')).toBe(true)
  })
})

describe('toPublisherError', () => {
  it('passes every code the server can send through unchanged', () => {
    for (const code of SERVER_CODES) {
      expect(toPublisherError({ message: 'x', extensions: { code } }, 200).code).toBe(code)
    }
  })

  it('maps the retired licence-type codes to UNKNOWN', () => {
    for (const code of [
      'UNKNOWN_APP',
      'APP_IDENTITY_INACTIVE',
      'UNKNOWN_LICENSE_TYPE',
      'UNKNOWN_LICENSE',
    ]) {
      expect(toPublisherError({ message: 'x', extensions: { code } }, 200).code).toBe('UNKNOWN')
    }
  })

  it('maps an unrecognised code to UNKNOWN', () => {
    expect(
      toPublisherError({ message: 'x', extensions: { code: 'INTERNAL_SERVER_ERROR' } }, 200).code,
    ).toBe('UNKNOWN')
  })
})

describe('describePublisherError', () => {
  it('keeps the server sentence for INVALID_INPUT and UNKNOWN: it is specific', () => {
    for (const code of ['INVALID_INPUT', 'UNKNOWN'] as const) {
      expect(
        describePublisherError(new PublisherApiError(code, 'kind 2026-pro already exists', null)),
      ).toBe('kind 2026-pro already exists')
    }
  })

  it('gives every other code plain-language copy', () => {
    const expected: Record<string, RegExp> = {
      UNAUTHENTICATED: /log in again/i,
      NOT_FOUND: /could not find/i,
      FORBIDDEN: /not allowed/i,
      APP_NOT_ACTIVE: /app is not active right now.*overview/i,
      NOT_ON_ALLOW_LIST: /allow list/i,
      TERM_NOT_ISSUABLE: /plan can.t be handed out this way/i,
      UNSUPPORTED_DID: /wallet address/i,
      LICENSING_DISABLED: /switched off/i,
      INVALID_CODE: /code can.t be used/i,
      ALREADY_HOLDS: /already have this plan/i,
    }
    for (const [code, copy] of Object.entries(expected)) {
      const text = describePublisherError(
        new PublisherApiError(code as never, 'raw server text', null),
      )
      expect(text).toMatch(copy)
      expect(text).not.toBe('raw server text')
    }
  })

  it('falls back to the message for a non-PublisherApiError', () => {
    expect(describePublisherError(new Error('plain'))).toBe('plain')
  })
})

describe('publisherGql response handling', () => {
  const run = (res: () => Response): Promise<PublisherApiError> =>
    publisherGql('{ ok }', undefined, 't', (async () => res()) as unknown as FetchLike).then(
      () => {
        throw new Error('expected publisherGql to reject')
      },
      (e: unknown) => e as PublisherApiError,
    )

  it('maps a non-OK status with no body to UNKNOWN, keeping the status', async () => {
    const err = await run(() => new Response('', { status: 502 }))
    expect(isPublisherError(err, 'UNKNOWN')).toBe(true)
    expect(err.status).toBe(502)
  })

  it('maps a 401 with no body to UNAUTHENTICATED', async () => {
    const err = await run(() => new Response('unauthorized', { status: 401 }))
    expect(isPublisherError(err, 'UNAUTHENTICATED')).toBe(true)
  })

  it('leaves a 403 with no body as UNKNOWN', async () => {
    expect(isPublisherError(await run(() => new Response('', { status: 403 })), 'UNKNOWN')).toBe(
      true,
    )
  })

  it('survives an HTML body', async () => {
    const err = await run(() => new Response('<html>bad gateway</html>', { status: 200 }))
    expect(isPublisherError(err, 'UNKNOWN')).toBe(true)
    expect(err.message).toBe('Empty response')
  })

  it('treats data: null as an empty response', async () => {
    const err = await run(() => jsonResponse({ data: null }))
    expect(isPublisherError(err, 'UNKNOWN')).toBe(true)
    expect(err.message).toBe('Empty response')
  })

  it('lets errors[0] win over a present data', async () => {
    const err = await run(() =>
      jsonResponse({
        data: { ok: 1 },
        errors: [{ message: 'nope', extensions: { code: 'INVALID_INPUT' } }],
      }),
    )
    expect(isPublisherError(err, 'INVALID_INPUT')).toBe(true)
  })

  it('lets a recognised code beat the schema-mismatch heuristic', () => {
    const err = toPublisherError(
      { message: 'Unknown argument "x" rejected', extensions: { code: 'INVALID_INPUT' } },
      200,
    )
    expect(err.code).toBe('INVALID_INPUT')
  })
})

describe('server message journey (publisherGql -> describePublisherError)', () => {
  const journey = async (message: string, code: string) => {
    const fetchImpl = (async () =>
      jsonResponse({ errors: [{ message, extensions: { code } }] })) as unknown as FetchLike
    const err = await publisherGql('mutation { x }', undefined, 't', fetchImpl).catch(
      (e: unknown) => e as PublisherApiError,
    )
    return describePublisherError(err)
  }

  it('shows the publisher the exact server sentence', async () => {
    const msg = 'ADD_TEMPLATE_SERVICE rejected: a service of that type already exists'
    expect(await journey(msg, 'INVALID_INPUT')).toBe(msg)
  })

  it('does not swap in our copy when a coded message mentions "Unknown argument"', async () => {
    const msg = 'Unknown argument "x" rejected'
    expect(await journey(msg, 'INVALID_INPUT')).toBe(msg)
  })
})

describe('retryPublisher', () => {
  // Retrying a coded refusal cannot change the answer: the server already decided.
  // It only burns the user's time and, were it ever wired to a mutation, could
  // double-apply a grant.
  const coded = (code: string) => new PublisherApiError(code as never, 'refused', 200)

  it('never retries a coded refusal, however early the failure', () => {
    for (const code of SERVER_CODES) {
      expect(retryPublisher(0, coded(code))).toBe(false)
      expect(retryPublisher(1, coded(code))).toBe(false)
    }
  })

  it('retries a transport failure twice, then gives up', () => {
    const net = new PublisherApiError('NETWORK', 'offline', null)
    expect(retryPublisher(0, net)).toBe(true)
    expect(retryPublisher(1, net)).toBe(true)
    expect(retryPublisher(2, net)).toBe(false)
  })

  it('retries UNKNOWN, which is the uncoded case, under the same cap', () => {
    const unknown = new PublisherApiError('UNKNOWN', '???', 500)
    expect(retryPublisher(0, unknown)).toBe(true)
    expect(retryPublisher(2, unknown)).toBe(false)
  })

  it('retries a non-publisher error under the same cap', () => {
    expect(retryPublisher(0, new Error('boom'))).toBe(true)
    expect(retryPublisher(2, new Error('boom'))).toBe(false)
  })
})
