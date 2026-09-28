// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../route'

afterEach(() => vi.unstubAllGlobals())

describe('GET /api/registry/manifest', () => {
  it('serves manifests without managed config keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Response.json({
          name: '@powerhousedao/workflow',
          config: [
            { name: 'PH_WORKFLOWS_SECRETS_MASTER_KEY', type: 'secret' },
            { name: 'PH_WORKFLOWS_RUN_CONCURRENCY', type: 'var' },
          ],
        }),
      ),
    )
    const res = await GET(
      new NextRequest(
        'http://localhost/api/registry/manifest?registry=https://registry.example&package=@powerhousedao/workflow',
      ),
    )
    const body = (await res.json()) as { config: Array<{ name: string }> }
    expect(body.config.map((c) => c.name)).toEqual(['PH_WORKFLOWS_RUN_CONCURRENCY'])
  })
})
