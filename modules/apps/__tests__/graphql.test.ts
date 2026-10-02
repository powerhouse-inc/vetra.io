import { describe, expect, it, vi } from 'vitest'

import {
  AppsApiError,
  appsGql,
  describeAppsError,
  describeCreateAppError,
  fetchApp,
  fetchMyApps,
  resetOptionalAppFields,
  isAppsError,
  toAppsError,
  type FetchLike,
} from '@/modules/apps/graphql'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('toAppsError', () => {
  it('keeps known extensions.code values', () => {
    const err = toAppsError({ message: 'nope', extensions: { code: 'GITHUB_NOT_CONNECTED' } })
    expect(err.code).toBe('GITHUB_NOT_CONNECTED')
    expect(err.message).toBe('nope')
  })

  it('maps every contract code through unchanged', () => {
    for (const code of [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'BAD_USER_INPUT',
      'PREVIEWS_DISABLED',
      'APP_NOT_ACTIVE',
      'GITHUB_NOT_CONNECTED',
      'SERVICE_NOT_CONFIGURED',
    ]) {
      expect(toAppsError({ message: 'x', extensions: { code } }).code).toBe(code)
    }
  })

  it('treats a schema without the subgraph as APPS_UNAVAILABLE', () => {
    const err = toAppsError(
      {
        message: 'Cannot query field "myApps" on type "Query".',
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
      },
      400,
    )
    expect(err.code).toBe('APPS_UNAVAILABLE')
    expect(err.status).toBe(400)
  })

  it('maps bare HTTP statuses', () => {
    expect(toAppsError(null, 401).code).toBe('UNAUTHENTICATED')
    expect(toAppsError(null, 403).code).toBe('FORBIDDEN')
    expect(toAppsError(null, 502).code).toBe('NETWORK')
  })

  it('falls back to UNKNOWN for unrecognised codes', () => {
    expect(
      toAppsError({ message: 'boom', extensions: { code: 'INTERNAL_SERVER_ERROR' } }).code,
    ).toBe('UNKNOWN')
  })
})

describe('appsGql', () => {
  it('sends the bearer token and returns data', async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(jsonResponse({ data: { myApps: [] } })),
    )
    const data = await appsGql<{ myApps: unknown[] }>(
      'query { myApps { id } }',
      {},
      'tok',
      fetchImpl,
    )
    expect(data.myApps).toEqual([])
    const init = fetchImpl.mock.calls[0][1]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(init.method).toBe('POST')
  })

  it('omits Authorization without a token', async () => {
    const fetchImpl = vi.fn<FetchLike>(() => Promise.resolve(jsonResponse({ data: { ok: true } })))
    await appsGql('query { ok }', {}, null, fetchImpl)
    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>
    expect('Authorization' in headers).toBe(false)
  })

  it('throws the mapped error from a 200 response with errors', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(
        jsonResponse({
          data: null,
          errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }],
        }),
      )
    const err = await appsGql('query { x }', {}, 't', fetchImpl).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AppsApiError)
    expect(isAppsError(err, 'FORBIDDEN')).toBe(true)
  })

  it('reads GraphQL errors from a 400 body', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(
        jsonResponse({ errors: [{ message: 'Cannot query field "app" on type "Query".' }] }, 400),
      )
    const err = await appsGql('query { x }', {}, 't', fetchImpl).catch((e: unknown) => e)
    expect(isAppsError(err, 'APPS_UNAVAILABLE')).toBe(true)
  })

  it('maps a 401 without a JSON body', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(new Response('unauthorized', { status: 401 }))
    const err = await appsGql('query { x }', {}, 't', fetchImpl).catch((e: unknown) => e)
    expect(isAppsError(err, 'UNAUTHENTICATED')).toBe(true)
  })

  it('wraps transport failures as NETWORK', async () => {
    const fetchImpl: FetchLike = () => Promise.reject(new TypeError('Failed to fetch'))
    const err = await appsGql('query { x }', {}, 't', fetchImpl).catch((e: unknown) => e)
    expect(isAppsError(err, 'NETWORK')).toBe(true)
  })
})

describe('describeAppsError', () => {
  it('gives friendly copy for known codes and passes other errors through', () => {
    expect(describeAppsError(new AppsApiError('GITHUB_NOT_CONNECTED', 'x'))).toMatch(/GitHub/)
    expect(describeAppsError(new AppsApiError('UNKNOWN', 'raw message'))).toBe('raw message')
    expect(describeAppsError(new Error('plain'))).toBe('plain')
  })
})

describe('describeCreateAppError', () => {
  it('explains a repo the user cannot access', () => {
    const msg = describeCreateAppError(new AppsApiError('FORBIDDEN', 'forbidden'), 'acme/site')
    expect(msg).toMatch(/acme\/site/)
    expect(msg).toMatch(/access/)
  })

  it('asks to reconnect GitHub when the user token is gone', () => {
    expect(
      describeCreateAppError(new AppsApiError('GITHUB_NOT_CONNECTED', 'x'), 'acme/site'),
    ).toMatch(/Reconnect GitHub/)
  })

  it('falls back to the generic copy', () => {
    expect(describeCreateAppError(new AppsApiError('UNKNOWN', 'raw'), 'a/b')).toBe('raw')
  })
})

describe('optional App fields', () => {
  it('retries without identityExpiresAt when the schema lacks it, then remembers', async () => {
    resetOptionalAppFields()
    const bodies: string[] = []
    const fetchImpl = vi.fn<FetchLike>((_url, init) => {
      const body = init.body as string
      bodies.push(body)
      if (body.includes('identityExpiresAt')) {
        return Promise.resolve(
          jsonResponse(
            { errors: [{ message: 'Cannot query field "identityExpiresAt" on type "App".' }] },
            400,
          ),
        )
      }
      return Promise.resolve(jsonResponse({ data: { myApps: [] } }))
    })
    expect(await fetchMyApps(null, fetchImpl)).toEqual([])
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).not.toContain('identityExpiresAt')
    await fetchMyApps(null, fetchImpl)
    expect(bodies).toHaveLength(3)
    expect(bodies[2]).not.toContain('identityExpiresAt')
  })

  it('keeps a real APPS_UNAVAILABLE error when the retry also fails', async () => {
    resetOptionalAppFields()
    const fetchImpl: FetchLike = () =>
      Promise.resolve(
        jsonResponse(
          { errors: [{ message: 'Cannot query field "myApps" on type "Query".' }] },
          400,
        ),
      )
    const err = await fetchMyApps(null, fetchImpl).catch((e: unknown) => e)
    expect(isAppsError(err, 'APPS_UNAVAILABLE')).toBe(true)
  })

  it('requests identityExpiresAt when supported', async () => {
    resetOptionalAppFields()
    const fetchImpl = vi.fn<FetchLike>(() => Promise.resolve(jsonResponse({ data: { app: null } })))
    await fetchApp('a1', null, fetchImpl)
    expect(fetchImpl.mock.calls[0][1].body as string).toContain('identityExpiresAt')
  })
})
