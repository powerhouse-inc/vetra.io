import { describe, expect, it, vi } from 'vitest'

import {
  AppsApiError,
  deleteAppSetting,
  describeAppsError,
  fetchAppSettings,
  setAppSetting,
  toAppsError,
  type FetchLike,
} from '@/modules/apps/graphql'
import {
  mergeAppSetting,
  settingNameError,
  settingValueError,
  settingsPending,
  splitSettingsReason,
  withoutAppSetting,
} from '@/modules/apps/lib/settings'
import type { AppSetting, AppSettings } from '@/modules/apps/types'

const reserved = {
  reservedNames: ['ADMINS', 'PH_HOST', 'PORT'],
  reservedPrefixes: ['VETRA_', 'NODE_', 'PG'],
}

function setting(over: Partial<AppSetting> = {}): AppSetting {
  return {
    name: 'API_URL',
    scope: 'ALL',
    secret: false,
    value: 'https://api.example.com',
    updatedAt: '2026-11-12T10:00:00Z',
    updatedBy: '0x1111111111111111111111111111111111111111',
    ...over,
  }
}

function settings(list: AppSetting[]): AppSettings {
  return { settings: list, vetra: [], ...reserved }
}

describe('settingNameError', () => {
  it('accepts capitals, digits and _ starting with a capital', () => {
    expect(settingNameError('SEKTAR_OAUTH_RELAY_BASE', reserved)).toBeNull()
    expect(settingNameError('A1', reserved)).toBeNull()
  })

  it('refuses empty, lowercase, leading digit or underscore and too long names', () => {
    expect(settingNameError('', reserved)).toMatch(/Enter a name/)
    expect(settingNameError('api_url', reserved)).toMatch(/capitals/)
    expect(settingNameError('1API', reserved)).toMatch(/capitals/)
    expect(settingNameError('_API', reserved)).toMatch(/capitals/)
    expect(settingNameError('API-URL', reserved)).toMatch(/capitals/)
    expect(settingNameError('A'.repeat(129), reserved)).toMatch(/128/)
  })

  it('refuses names and prefixes Vetra reserves', () => {
    expect(settingNameError('ADMINS', reserved)).toMatch(/set by Vetra/)
    expect(settingNameError('VETRA_ANYTHING', reserved)).toMatch(/VETRA_/)
    expect(settingNameError('PGPASSWORD', reserved)).toMatch(/PG/)
    expect(settingNameError('NODE_EXTRA', reserved)).toMatch(/NODE_/)
  })
})

describe('settingValueError', () => {
  it('allows an empty plain value, refuses an empty secret', () => {
    expect(settingValueError('A', '', false)).toBeNull()
    expect(settingValueError('A', '', true)).toMatch(/Enter the secret/)
  })

  it('caps plain values at 4 KiB and secrets at 64 KiB, in bytes', () => {
    expect(settingValueError('A', 'x'.repeat(4096), false)).toBeNull()
    expect(settingValueError('A', 'x'.repeat(4097), false)).toMatch(/4 KiB/)
    // 2-byte characters count twice
    expect(settingValueError('A', 'é'.repeat(2049), false)).toMatch(/4 KiB/)
    expect(settingValueError('A', 'x'.repeat(65536), true)).toBeNull()
    expect(settingValueError('A', 'x'.repeat(65537), true)).toMatch(/64 KiB/)
  })

  it('refuses a NEXT_PUBLIC_ secret', () => {
    expect(settingValueError('NEXT_PUBLIC_KEY', 'v', true)).toMatch(/NEXT_PUBLIC_/)
    expect(settingValueError('NEXT_PUBLIC_KEY', 'v', false)).toBeNull()
  })

  it('never echoes the value', () => {
    const msg = settingValueError('A', 's3cr3t'.repeat(20000), true)
    expect(msg).not.toContain('s3cr3t')
  })
})

describe('mergeAppSetting / withoutAppSetting', () => {
  it('replaces the same name and scope and keeps the list sorted by name then scope', () => {
    const data = settings([
      setting({ name: 'B', scope: 'PREVIEW' }),
      setting({ name: 'C' }),
      setting({ name: 'B', scope: 'ALL', value: 'old' }),
    ])
    const next = mergeAppSetting(data, setting({ name: 'B', scope: 'ALL', value: 'new' }))
    expect(next?.settings.map((s) => `${s.name}:${s.scope}:${s.value}`)).toEqual([
      'B:ALL:new',
      'B:PREVIEW:https://api.example.com',
      'C:ALL:https://api.example.com',
    ])
    expect(mergeAppSetting(undefined, setting())).toBeUndefined()
  })

  it('removes only the given name and scope', () => {
    const data = settings([
      setting({ name: 'B', scope: 'ALL' }),
      setting({ name: 'B', scope: 'BRANCH' }),
    ])
    expect(withoutAppSetting(data, 'B', 'BRANCH')?.settings).toEqual([setting({ name: 'B' })])
  })
})

describe('settingsPending', () => {
  it('is true only when a target revision differs from the running one', () => {
    expect(settingsPending({ settingsRevision: 'aa', runningSettingsRevision: 'bb' })).toBe(true)
    expect(settingsPending({ settingsRevision: 'aa', runningSettingsRevision: null })).toBe(true)
    expect(settingsPending({ settingsRevision: 'aa', runningSettingsRevision: 'aa' })).toBe(false)
    expect(settingsPending({ settingsRevision: null, runningSettingsRevision: 'aa' })).toBe(false)
    expect(settingsPending({})).toBe(false)
  })
})

describe('splitSettingsReason', () => {
  it('splits the reconciler prefix from the cause', () => {
    expect(splitSettingsReason('after a settings change: crash loop')).toEqual({
      afterSettingsChange: true,
      cause: 'crash loop',
    })
    expect(splitSettingsReason('image pull failed')).toEqual({
      afterSettingsChange: false,
      cause: 'image pull failed',
    })
    expect(splitSettingsReason(null)).toEqual({ afterSettingsChange: false, cause: null })
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sent(fetchImpl: ReturnType<typeof vi.fn<FetchLike>>) {
  const init = fetchImpl.mock.calls[0][1]
  return JSON.parse(init.body as string) as { query: string; variables: Record<string, unknown> }
}

describe('settings API', () => {
  it('fetchAppSettings selects settings, vetra and the reserved names', async () => {
    const data = settings([setting()])
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(jsonResponse({ data: { appSettings: data } })),
    )
    expect(await fetchAppSettings('app-1', 'tok', fetchImpl)).toEqual(data)
    const { query, variables } = sent(fetchImpl)
    expect(variables).toEqual({ appId: 'app-1' })
    expect(query).toContain('settings { name scope secret value updatedAt updatedBy }')
    expect(query).toContain('vetra { name secret value }')
    expect(query).toContain('reservedNames reservedPrefixes')
  })

  it('setAppSetting sends the whole input', async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(
        jsonResponse({ data: { setAppSetting: setting({ secret: true, value: null }) } }),
      ),
    )
    const input = {
      appId: 'app-1',
      name: 'API_KEY',
      value: 'v',
      secret: true,
      scope: 'BRANCH' as const,
    }
    await setAppSetting(input, 'tok', fetchImpl)
    const { query, variables } = sent(fetchImpl)
    expect(query).toMatch(/setAppSetting\(input: \$input\)/)
    expect(variables).toEqual({ input })
  })

  it('deleteAppSetting passes name and scope', async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(jsonResponse({ data: { deleteAppSetting: true } })),
    )
    expect(await deleteAppSetting('app-1', 'API_KEY', 'PREVIEW', 'tok', fetchImpl)).toBe(true)
    expect(sent(fetchImpl).variables).toEqual({ appId: 'app-1', name: 'API_KEY', scope: 'PREVIEW' })
  })

  it('maps SERVICE_UNAVAILABLE and keeps the server wording', () => {
    const err = toAppsError({
      message: 'Secret storage unavailable',
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    })
    expect(err).toBeInstanceOf(AppsApiError)
    expect(err.code).toBe('SERVICE_UNAVAILABLE')
    expect(describeAppsError(err)).toBe('Secret storage unavailable')
  })
})
