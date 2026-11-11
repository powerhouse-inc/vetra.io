import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppRelease, AppReleaseKind } from '../types'

type QueryState = {
  data: AppRelease[] | undefined
  isPending: boolean
  error: Error | null
  isFetching?: boolean
}
let state: QueryState
const refetch = vi.fn()
const useAppReleases = vi.fn<
  (appId: string, kind: AppReleaseKind | null, limit: number, enabled?: boolean) => unknown
>(() => ({ ...state, refetch, isRefetching: false }))

vi.mock('../hooks/use-apps', () => ({
  useAppReleases: (appId: string, kind: AppReleaseKind | null, limit: number, enabled?: boolean) =>
    useAppReleases(appId, kind, limit, enabled),
}))

import { AppReleases } from '../components/app-releases'
import { AppsApiError } from '../graphql'

const DIGEST = 'sha256:3b99fd52e4c0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a'

function release(over: Partial<AppRelease> = {}): AppRelease {
  return {
    version: '1.1.0-beta.0',
    kind: 'release',
    branch: 'vetra-next',
    pr: null,
    commit: '0123456789abcdef0123456789abcdef01234567',
    notes: '## 1.1.0-beta.0\n\n### Features\n\n- **apps:** releases tab',
    customerNotes: null,
    imageRef: 'cr.vetra.io/sektar/sektar:1.1.0-beta.0',
    imageDigest: DIGEST,
    host: 'cr.vetra.io',
    packages: [{ name: '@sektar/app', version: '1.1.0-beta.0' }],
    migrates: false,
    powerhouseVersion: '6.0.0-dev.152',
    createdAt: '2026-11-10T12:00:00Z',
    ...over,
  }
}

const sektar = [
  release(),
  release({
    version: '1.1.0-beta.0-vetra-next.71',
    kind: 'build',
    notes: null,
    imageRef: 'cr.vetra.io/sektar/sektar:1.1.0-beta.0-vetra-next.71',
  }),
  release({
    version: '1.0.10-vetra-publish-test.70',
    kind: 'build',
    branch: null,
    pr: 70,
    notes: null,
    migrates: true,
  }),
  release({ version: '0.0.0-alpha.1', notes: '## Test release' }),
  release({ version: '1.0.0', notes: null }),
]

const row = (version: string) => screen.getByTestId(`release-${version}`)

describe('AppReleases', () => {
  beforeEach(() => {
    cleanup()
    useAppReleases.mockClear()
    refetch.mockClear()
    state = { data: sektar, isPending: false, error: null }
  })

  it('starts with releases and builds, 50 at a time', () => {
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    expect(useAppReleases).toHaveBeenLastCalledWith('app-1', null, 50, true)
  })

  it('shows one row per version with its kind badge', () => {
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    expect(within(row('1.1.0-beta.0')).getByText('Prerelease')).toBeTruthy()
    expect(within(row('0.0.0-alpha.1')).getByText('Prerelease')).toBeTruthy()
    expect(within(row('1.0.0')).getByText('Release')).toBeTruthy()
    expect(within(row('1.1.0-beta.0-vetra-next.71')).getByText('Build')).toBeTruthy()
  })

  it('shows source, commit, Powerhouse version and when', () => {
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    const r = row('1.1.0-beta.0')
    expect(within(r).getByText('vetra-next')).toBeTruthy()
    const commit = within(r).getByRole('link', { name: '0123456' })
    expect(commit.getAttribute('href')).toBe(
      'https://github.com/powerhouse-inc/sektar/commit/0123456789abcdef0123456789abcdef01234567',
    )
    expect(within(r).getByText('6.0.0-dev.152')).toBeTruthy()
    expect(within(r).getByText(/ago$/).getAttribute('title')).toMatch(/2026/)
  })

  it('links a PR build to its pull request and flags migrations', () => {
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    const r = row('1.0.10-vetra-publish-test.70')
    expect(within(r).getByRole('link', { name: 'PR #70' }).getAttribute('href')).toBe(
      'https://github.com/powerhouse-inc/sektar/pull/70',
    )
    expect(within(r).getByText('Migrates')).toBeTruthy()
    expect(within(row('1.1.0-beta.0')).queryByText('Migrates')).toBeNull()
  })

  it('does not query, and shows nothing, for an app without a repository', () => {
    const { container } = render(<AppReleases appId="app-1" repository={null} />)
    expect(useAppReleases).toHaveBeenLastCalledWith('app-1', null, 50, false)
    expect(container.textContent).toBe('')
  })

  it('switches the filter and asks for the matching kind', () => {
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Builds' }))
    expect(useAppReleases).toHaveBeenLastCalledWith('app-1', 'build', 50, true)
    expect(screen.getByRole('button', { name: 'Builds' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Releases' }))
    expect(useAppReleases).toHaveBeenLastCalledWith('app-1', 'release', 50, true)
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(useAppReleases).toHaveBeenLastCalledWith('app-1', null, 50, true)
  })

  it('offers "Show more" when the page is full, raising the limit to 200', () => {
    state = {
      data: Array.from({ length: 50 }, (_, i) => release({ version: `1.0.${i}` })),
      isPending: false,
      error: null,
    }
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(useAppReleases).toHaveBeenLastCalledWith('app-1', null, 200, true)
  })

  it('hides "Show more" when everything is shown', () => {
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })

  it('expands a row to show notes, image and packages', () => {
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    const toggle = within(row('1.1.0-beta.0')).getByRole('button', {
      name: /1\.1\.0-beta\.0/,
    })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('release-details-1.1.0-beta.0')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    const details = screen.getByTestId('release-details-1.1.0-beta.0')
    // Markdown: the heading and the bold scope are elements, not raw syntax.
    expect(within(details).getByText('Features')).toBeTruthy()
    expect(within(details).getByText('apps:').tagName).toBe('STRONG')
    expect(within(details).getByText('cr.vetra.io/sektar/sektar:1.1.0-beta.0')).toBeTruthy()
    expect(within(details).getByText('sha256:3b99fd52…')).toBeTruthy()
    const pkg = within(details).getByRole('link', { name: '@sektar/app@1.1.0-beta.0' })
    expect(pkg.getAttribute('href')).toBe('https://registry.vetra.io/@sektar/app')
  })

  it('shows notes for owners only when they differ from the release notes', () => {
    const notes = '## 1.1.0-beta.0\n\n- same text'
    state = {
      data: [
        release({ notes, customerNotes: notes }),
        release({ version: '1.2.0', notes, customerNotes: '## For you\n\n- edited' }),
      ],
      isPending: false,
      error: null,
    }
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    fireEvent.click(within(row('1.1.0-beta.0')).getByRole('button', { name: /1\.1\.0-beta\.0/ }))
    fireEvent.click(within(row('1.2.0')).getByRole('button', { name: /1\.2\.0/ }))
    expect(
      within(screen.getByTestId('release-details-1.1.0-beta.0')).queryByText('Notes for owners'),
    ).toBeNull()
    expect(
      within(screen.getByTestId('release-details-1.2.0')).getByText('Notes for owners'),
    ).toBeTruthy()
  })

  it('does not link the packages of a build', () => {
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    fireEvent.click(
      within(row('1.1.0-beta.0-vetra-next.71')).getByRole('button', {
        name: /1\.1\.0-beta\.0-vetra-next\.71/,
      }),
    )
    const details = screen.getByTestId('release-details-1.1.0-beta.0-vetra-next.71')
    expect(within(details).getByText('@sektar/app@1.1.0-beta.0')).toBeTruthy()
    expect(within(details).queryByRole('link', { name: /@sektar\/app/ })).toBeNull()
    expect(within(details).getByText('No release notes.')).toBeTruthy()
  })

  it('copies the full image reference and the full digest', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    fireEvent.click(within(row('1.1.0-beta.0')).getByRole('button', { name: /1\.1\.0-beta\.0/ }))
    const click = (name: string) =>
      act(async () => {
        fireEvent.click(screen.getByRole('button', { name }))
        await Promise.resolve()
      })
    await click('Copy image')
    expect(writeText).toHaveBeenLastCalledWith('cr.vetra.io/sektar/sektar:1.1.0-beta.0')
    await click('Copy digest')
    expect(writeText).toHaveBeenLastCalledWith(DIGEST)
  })

  it('words the empty state after the filter', () => {
    state = { data: [], isPending: false, error: null }
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    expect(screen.getByText('Nothing published yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Releases' }))
    expect(screen.getByText('No releases yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Builds' }))
    expect(screen.getByText('No builds yet')).toBeTruthy()
    expect(screen.getByRole('link', { name: /vetra-publish/i })).toBeTruthy()
  })

  it('shows the empty state with a link to vetra-publish', () => {
    state = { data: [], isPending: false, error: null }
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    expect(
      screen.getByText(
        "No releases yet. Releases and builds appear here once the app's workflow runs powerhouse-inc/vetra-publish.",
      ),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: /vetra-publish/i }).getAttribute('href')).toBe(
      'https://github.com/powerhouse-inc/vetra-publish#readme',
    )
  })

  it('shows a skeleton while loading', () => {
    state = { data: undefined, isPending: true, error: null }
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    expect(screen.getByRole('status', { name: 'Loading releases' })).toBeTruthy()
  })

  it('offers a retry with the apps copy when the list fails to load', () => {
    state = {
      data: undefined,
      isPending: false,
      error: new AppsApiError('NETWORK', 'fetch failed'),
    }
    render(<AppReleases appId="app-1" repository="powerhouse-inc/sektar" />)
    expect(within(screen.getByRole('alert')).getByText(/Could not reach Vetra/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })
})
