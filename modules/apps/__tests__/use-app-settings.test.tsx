import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { AppInstance, AppSetting, AppSettings } from '../types'

const setAppSetting = vi.fn()
const deleteAppSetting = vi.fn()

vi.mock('@powerhousedao/reactor-browser', () => ({ useDid: () => 'did:me', useRenown: () => null }))
vi.mock('@/modules/cloud/graphql', () => ({ getAuthToken: () => Promise.resolve('tok') }))
vi.mock('../graphql', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../graphql')>()),
  setAppSetting: (...args: unknown[]) => setAppSetting(...args) as Promise<AppSetting>,
  deleteAppSetting: (...args: unknown[]) => deleteAppSetting(...args) as Promise<boolean>,
}))

import { instancesPollInterval, useDeleteAppSetting, useSetAppSetting } from '../hooks/use-apps'

const key = ['apps', 'settings', 'app-1', 'did:me']

const setting = (over: Partial<AppSetting> = {}): AppSetting => ({
  name: 'API_URL',
  scope: 'ALL',
  secret: false,
  value: 'https://a',
  updatedAt: '2026-11-12T10:00:00Z',
  updatedBy: '0xabc',
  ...over,
})

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const data: AppSettings = {
    settings: [setting()],
    vetra: [],
    reservedNames: [],
    reservedPrefixes: [],
  }
  qc.setQueryData(key, data)
  const invalidate = vi.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, invalidate, wrapper }
}

describe('useSetAppSetting', () => {
  it('sends the app id, caches the new setting and refreshes settings and instances', async () => {
    const { qc, invalidate, wrapper } = setup()
    const secret = setting({ name: 'API_KEY', secret: true, value: null })
    setAppSetting.mockResolvedValueOnce(secret)
    const { result } = renderHook(() => useSetAppSetting('app-1'), { wrapper })
    await act(() =>
      result.current.mutateAsync({ name: 'API_KEY', value: 'v', secret: true, scope: 'ALL' }),
    )
    expect(setAppSetting).toHaveBeenCalledWith(
      { appId: 'app-1', name: 'API_KEY', value: 'v', secret: true, scope: 'ALL' },
      'tok',
    )
    expect(qc.getQueryData<AppSettings>(key)?.settings.map((s) => s.name)).toEqual([
      'API_KEY',
      'API_URL',
    ])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['apps', 'instances', 'app-1', 'did:me'] })
  })
})

describe('useDeleteAppSetting', () => {
  it('drops the setting from the cache and refreshes settings and instances', async () => {
    const { qc, invalidate, wrapper } = setup()
    deleteAppSetting.mockResolvedValueOnce(true)
    const { result } = renderHook(() => useDeleteAppSetting('app-1'), { wrapper })
    await act(() => result.current.mutateAsync({ name: 'API_URL', scope: 'ALL' }))
    expect(deleteAppSetting).toHaveBeenCalledWith('app-1', 'API_URL', 'ALL', 'tok')
    expect(qc.getQueryData<AppSettings>(key)?.settings).toEqual([])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['apps', 'instances', 'app-1', 'did:me'] })
  })
})

describe('instancesPollInterval', () => {
  const inst = (over: Partial<AppInstance>) => ({ status: 'ready', ...over }) as AppInstance
  it('polls while a running instance still has to pick up a settings change', () => {
    expect(
      instancesPollInterval([inst({ settingsRevision: 'b', runningSettingsRevision: 'a' })]),
    ).toBe(10_000)
    expect(
      instancesPollInterval([
        inst({ status: 'failed', settingsRevision: 'b', runningSettingsRevision: 'a' }),
      ]),
    ).toBe(false)
    expect(
      instancesPollInterval([inst({ settingsRevision: 'a', runningSettingsRevision: 'a' })]),
    ).toBe(false)
  })
})
