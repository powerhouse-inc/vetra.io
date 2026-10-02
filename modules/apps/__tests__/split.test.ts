import { describe, expect, it } from 'vitest'

import {
  activeAppIds,
  attachableEnvironments,
  isAppEnvironment,
  splitEnvironments,
} from '@/modules/apps/lib/split'
import type { CloudEnvironmentAppLink } from '@/modules/cloud/types'

const env = (id: string, app?: CloudEnvironmentAppLink | null) => ({ id, app })

describe('splitEnvironments (Apps home)', () => {
  it('hides App-owned envs from the standalone list', () => {
    const { standalone, appOwned } = splitEnvironments([
      env('standalone-1'),
      env('prod', { appId: 'app-1', role: 'PRODUCTION', prNumber: null }),
      env('preview', { appId: 'app-1', role: 'PREVIEW', prNumber: 7 }),
      env('standalone-2', null),
    ])
    expect(standalone.map((e) => e.id)).toEqual(['standalone-1', 'standalone-2'])
    expect(appOwned.map((e) => e.id)).toEqual(['prod', 'preview'])
  })

  it('treats everything as standalone on backends without app fields', () => {
    const { standalone, appOwned } = splitEnvironments([env('a'), env('b')])
    expect(standalone).toHaveLength(2)
    expect(appOwned).toHaveLength(0)
  })

  it('ignores an empty appId', () => {
    expect(isAppEnvironment(env('x', { appId: '', role: null, prNumber: null }))).toBe(false)
  })
})

describe('splitEnvironments with the live app list', () => {
  const prod = env('prod', { appId: 'app-1', role: 'PRODUCTION', prNumber: null })
  const kept = env('kept', { appId: 'gone', role: 'PRODUCTION', prNumber: null })
  const preview = env('pr', { appId: 'app-1', role: 'PREVIEW', prNumber: 3 })

  it('treats envs of apps missing from myApps as standalone', () => {
    const { standalone, appOwned } = splitEnvironments(
      [prod, kept, preview],
      activeAppIds([{ id: 'app-1', status: 'ACTIVE' }]),
    )
    expect(standalone.map((e) => e.id)).toEqual(['kept'])
    expect(appOwned.map((e) => e.id)).toEqual(['prod', 'pr'])
  })

  it('treats envs of DELETED apps as standalone', () => {
    const ids = activeAppIds([{ id: 'app-1', status: 'DELETED' }])
    expect(isAppEnvironment(prod, ids)).toBe(false)
    expect(splitEnvironments([prod], ids).standalone).toHaveLength(1)
  })

  it('falls back to appId presence while the app list is unknown', () => {
    expect(isAppEnvironment(kept, null)).toBe(true)
    expect(activeAppIds(undefined)).toBeNull()
  })
})

describe('attachableEnvironments (new-app "use existing")', () => {
  const studio = (id: string) => ({ id, app: null, state: { studioInstanceId: 'studio-1' } })
  const plain = (id: string, app: CloudEnvironmentAppLink | null = null) => ({
    id,
    app,
    state: { studioInstanceId: null },
  })

  it('offers only envs with no app link at all and no studio', () => {
    const kept = plain('kept-from-deleted-app', {
      appId: 'deleted',
      role: 'PRODUCTION',
      prNumber: null,
    })
    const result = attachableEnvironments([
      plain('free'),
      kept,
      studio('studio-env'),
      plain('also-free'),
    ])
    expect(result.map((e) => e.id)).toEqual(['free', 'also-free'])
  })
})
