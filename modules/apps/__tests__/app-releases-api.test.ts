import { describe, expect, it, vi } from 'vitest'

import { fetchAppReleases, type FetchLike } from '@/modules/apps/graphql'
import {
  RELEASES_LIMIT,
  RELEASES_MORE_LIMIT,
  releaseBadge,
  releasePackageUrl,
  shortDigest,
} from '@/modules/apps/lib/releases'
import type { AppRelease } from '@/modules/apps/types'

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

describe('fetchAppReleases', () => {
  it('selects every AppRelease field and passes appId, kind and limit', async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(jsonResponse({ data: { appReleases: [] } })),
    )
    expect(await fetchAppReleases('app-1', 'build', 200, 'tok', fetchImpl)).toEqual([])
    const { query, variables } = sent(fetchImpl)
    expect(variables).toEqual({ appId: 'app-1', kind: 'build', limit: 200 })
    expect(query).toMatch(/appReleases\(appId: \$appId, kind: \$kind, limit: \$limit\)/)
    for (const field of [
      'version',
      'kind',
      'branch',
      'pr',
      'commit',
      'notes',
      'customerNotes',
      'imageRef',
      'imageDigest',
      'host',
      'packages { name version }',
      'migrates',
      'powerhouseVersion',
      'createdAt',
    ]) {
      expect(query).toContain(field)
    }
  })

  it('sends a null kind for both releases and builds', async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(jsonResponse({ data: { appReleases: [] } })),
    )
    await fetchAppReleases('app-1', null, 50, null, fetchImpl)
    expect(sent(fetchImpl).variables).toEqual({ appId: 'app-1', kind: null, limit: 50 })
  })

  it('surfaces FORBIDDEN as an apps error', async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(
        jsonResponse({ errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] }),
      ),
    )
    await expect(fetchAppReleases('app-1', null, 50, null, fetchImpl)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})

const base: AppRelease = {
  version: '1.1.0-beta.0',
  kind: 'release',
  branch: 'vetra-next',
  pr: null,
  commit: 'abcdef1234567890',
  notes: null,
  customerNotes: null,
  imageRef: 'cr.vetra.io/sektar/sektar:1.1.0-beta.0',
  imageDigest: 'sha256:3b99fd52aaaabbbbccccdddd',
  host: 'cr.vetra.io',
  packages: [],
  migrates: false,
  powerhouseVersion: '6.0.0',
  createdAt: '2026-11-10T00:00:00Z',
}

describe('release helpers', () => {
  it('labels releases, prereleases and builds', () => {
    expect(releaseBadge({ ...base, version: '1.0.0' })).toBe('Release')
    expect(releaseBadge({ ...base, version: '1.1.0-beta.0' })).toBe('Prerelease')
    expect(releaseBadge({ ...base, version: '0.0.0-alpha.1' })).toBe('Prerelease')
    expect(releaseBadge({ ...base, version: '2.0.0-rc.3' })).toBe('Prerelease')
    // The server's rule: alpha|beta|rc followed by a number, nothing after, lower case.
    expect(releaseBadge({ ...base, version: '2.0.0-beta' })).toBe('Release')
    expect(releaseBadge({ ...base, version: '2.0.0-Beta.1' })).toBe('Release')
    expect(releaseBadge({ ...base, version: '1.1.0-beta.0-vetra-next.71' })).toBe('Release')
    expect(releaseBadge({ ...base, kind: 'build', version: '2.0.0-beta' })).toBe('Build')
    expect(releaseBadge({ ...base, kind: 'build', version: '1.1.0-beta.0-vetra-next.71' })).toBe(
      'Build',
    )
  })

  it('shortens a digest to its first 8 hex characters', () => {
    expect(shortDigest('sha256:3b99fd52aaaabbbbccccdddd')).toBe('sha256:3b99fd52…')
    expect(shortDigest('abc')).toBe('abc')
  })

  it('links packages to the registry only for releases', () => {
    expect(releasePackageUrl(base, '@sektar/app')).toBe('https://registry.vetra.io/@sektar/app')
    expect(releasePackageUrl({ ...base, kind: 'build' }, '@sektar/app')).toBeNull()
  })

  it('links only well-formed package names', () => {
    expect(releasePackageUrl(base, 'plain-pkg')).toBe('https://registry.vetra.io/plain-pkg')
    expect(releasePackageUrl(base, '@sektar/app.core')).toBe(
      'https://registry.vetra.io/@sektar/app.core',
    )
    expect(releasePackageUrl(base, '@a/b?x=1#y')).toBeNull()
    expect(releasePackageUrl(base, '../../evil')).toBeNull()
    expect(releasePackageUrl(base, 'a/b')).toBeNull()
  })

  it('raises the limit from 50 to 200 on "Show more"', () => {
    expect(RELEASES_LIMIT).toBe(50)
    expect(RELEASES_MORE_LIMIT).toBe(200)
  })
})
