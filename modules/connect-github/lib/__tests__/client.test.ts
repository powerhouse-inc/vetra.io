import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectGithub, myGithubConnection, startGithubDeviceFlow } from '../client'
import type { ConnectResult } from '../client'

function gqlResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('connect-github client', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('startGithubDeviceFlow', () => {
    it('returns the device flow and sends the bearer token', async () => {
      const flow = {
        deviceCode: 'dev',
        userCode: 'WXYZ-1234',
        verificationUri: 'https://github.com/login/device',
        expiresIn: 900,
        interval: 5,
      }
      fetchMock.mockResolvedValue(
        gqlResponse({ data: { VetraGithubAuth: { startGithubDeviceFlow: flow } } }),
      )

      expect(await startGithubDeviceFlow('tok')).toEqual(flow)
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok')
    })

    it('returns null on transport failure', async () => {
      fetchMock.mockResolvedValue(gqlResponse(null, 500))
      expect(await startGithubDeviceFlow('tok')).toBeNull()
    })
  })

  describe('myGithubConnection', () => {
    it('returns the connection status', async () => {
      const status = {
        connected: true,
        connection: {
          environmentId: 'env-1',
          repoFullName: 'alice/widget',
          repoUrl: 'https://github.com/alice/widget',
          createdAt: '2026-01-01T00:00:00Z',
        },
      }
      fetchMock.mockResolvedValue(
        gqlResponse({ data: { VetraGithubAuth: { myGithubConnection: status } } }),
      )

      expect(await myGithubConnection('env-1', 'tok')).toEqual(status)
    })
  })

  describe('connectGithub', () => {
    it('returns connected with the connection when the backend reports success', async () => {
      const status = {
        connected: true,
        connection: {
          environmentId: 'env-1',
          repoFullName: 'alice/widget',
          repoUrl: 'https://github.com/alice/widget',
          createdAt: '2026-01-01T00:00:00Z',
        },
      }
      fetchMock.mockResolvedValue(
        gqlResponse({ data: { VetraGithubAuth: { connectGithub: status } } }),
      )

      expect(await connectGithub('dev', 'widget', 'env-1', 'tok')).toEqual({
        status: 'connected',
        connection: status.connection,
      })
    })

    const ERROR_CASES: Array<{ message: string; status: ConnectResult['status'] }> = [
      { message: 'AUTHORIZATION_PENDING', status: 'pending' },
      { message: 'SLOW_DOWN', status: 'slowDown' },
      { message: 'DEVICE_CODE_EXPIRED', status: 'expired' },
      { message: 'ACCESS_DENIED', status: 'denied' },
      { message: 'APP_NOT_INSTALLED', status: 'appNotInstalled' },
      { message: 'REPO_ALREADY_EXISTS', status: 'repoExists' },
      { message: 'UNAUTHENTICATED', status: 'unauthenticated' },
    ]

    it.each(ERROR_CASES)(
      'maps $message to $status and keeps polling state',
      async ({ message, status }) => {
        fetchMock.mockResolvedValue(gqlResponse({ errors: [{ message }] }))
        expect(await connectGithub('dev', 'widget', 'env-1', 'tok')).toEqual({ status })
      },
    )

    it('reads the error code from extensions.code', async () => {
      fetchMock.mockResolvedValue(
        gqlResponse({ errors: [{ extensions: { code: 'APP_NOT_INSTALLED' } }] }),
      )
      expect(await connectGithub('dev', 'widget', 'env-1', 'tok')).toEqual({
        status: 'appNotInstalled',
      })
    })

    it('passes through an unmapped error message', async () => {
      fetchMock.mockResolvedValue(gqlResponse({ errors: [{ message: 'WEIRD' }] }))
      expect(await connectGithub('dev', 'widget', 'env-1', 'tok')).toEqual({
        status: 'error',
        message: 'WEIRD',
      })
    })

    it('returns an error status on transport failure', async () => {
      fetchMock.mockResolvedValue(gqlResponse(null, 500))
      expect(await connectGithub('dev', 'widget', 'env-1', 'tok')).toEqual({
        status: 'error',
        message: 'HTTP_500',
      })
    })
  })
})
