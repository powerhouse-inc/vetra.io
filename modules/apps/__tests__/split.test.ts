import { describe, expect, it } from 'vitest'

import { isAppEnvironment, splitEnvironments } from '@/modules/apps/lib/split'
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
