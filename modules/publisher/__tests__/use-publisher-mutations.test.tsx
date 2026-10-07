import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { names, fns, waitForToken, getAuthToken } = vi.hoisted(() => {
  const names = [
    'createLicenseType', 'setLicenseTypeDetails', 'setLicenseTypeTemplate',
    'addLicenseTypeService', 'addLicenseTypePackage', 'publishLicenseType',
    'retireLicenseType', 'issueGrant', 'revokeLicense',
  ] as const
  const fns = Object.fromEntries(names.map((n) => [n, vi.fn()])) as Record<(typeof names)[number], ReturnType<typeof vi.fn>>
  return { names, fns, waitForToken: vi.fn(), getAuthToken: vi.fn() }
})

vi.mock('../graphql', async (orig) => {
  const real = await orig<typeof import('../graphql')>()
  return {
    ...real,
    ...Object.fromEntries(names.map((n) => [n, (...a: unknown[]) => fns[n](...a)])),
  }
})
vi.mock('@/modules/apps/lib/token', () => ({ waitForToken: (f: () => unknown) => waitForToken(f) }))
vi.mock('@/modules/cloud/graphql', () => ({ getAuthToken: (...a: unknown[]) => getAuthToken(...a) }))
vi.mock('@powerhousedao/reactor-browser', () => ({
  useDid: () => 'did:key:z1',
  useRenown: () => ({ user: { did: 'did:key:z1' } }),
}))

import * as h from '../hooks/use-publisher-mutations'
import { publisherKeys } from '../hooks/keys'

let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
)

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  names.forEach((n) => fns[n].mockReset().mockResolvedValue(true))
  fns.createLicenseType.mockResolvedValue('lt-1')
  fns.issueGrant.mockResolvedValue('lic-1')
  getAuthToken.mockReset().mockResolvedValue('bare-tok')
  // Distinct sentinel: proves the value came from waitForToken's result.
  waitForToken.mockReset().mockResolvedValue('waited-tok')
})

const cases: [string, (a: string) => unknown, (typeof names)[number], unknown][] = [
  ['useCreateLicenseType', h.useCreateLicenseType, 'createLicenseType', { appId: 'app-1', kind: 'PRO' }],
  ['useSetLicenseTypeDetails', h.useSetLicenseTypeDetails, 'setLicenseTypeDetails', { licenseTypeId: 'lt-1', label: 'x' }],
  ['useSetLicenseTypeTemplate', h.useSetLicenseTypeTemplate, 'setLicenseTypeTemplate', { licenseTypeId: 'lt-1', size: 'S' }],
  ['useAddLicenseTypeService', h.useAddLicenseTypeService, 'addLicenseTypeService', { licenseTypeId: 'lt-1', type: 'SWITCHBOARD' }],
  ['useAddLicenseTypePackage', h.useAddLicenseTypePackage, 'addLicenseTypePackage', { licenseTypeId: 'lt-1', packageName: 'p' }],
  ['usePublishLicenseType', h.usePublishLicenseType, 'publishLicenseType', 'lt-1'],
  ['useRetireLicenseType', h.useRetireLicenseType, 'retireLicenseType', 'lt-1'],
  ['useIssueGrant', h.useIssueGrant, 'issueGrant', { appId: 'app-1', licenseTypeId: 'lt-1', user: '0xabc' }],
  ['useRevokeLicense', h.useRevokeLicense, 'revokeLicense', { licenseId: 'lic-1' }],
]

type Mut = { mutateAsync: (v: unknown) => Promise<unknown> }
const run = async (hook: (a: string) => unknown, vars: unknown) => {
  const { result } = renderHook(() => hook('app-1') as Mut, { wrapper })
  let out: unknown
  await act(async () => { out = await result.current.mutateAsync(vars) })
  return out
}

describe('publisher mutation hooks', () => {
  it.each(cases)('%s resolves its token via waitForToken and passes variables through', async (_n, hook, fn, vars) => {
    await run(hook, vars)
    expect(waitForToken).toHaveBeenCalledTimes(1)
    expect(fns[fn]).toHaveBeenCalledWith(vars, 'waited-tok')
    expect(getAuthToken).not.toHaveBeenCalled()
  })

  it('returns the new ids from create and grant', async () => {
    expect(await run(h.useCreateLicenseType, { appId: 'app-1', kind: 'PRO' })).toBe('lt-1')
    expect(await run(h.useIssueGrant, { appId: 'app-1', licenseTypeId: 'lt-1', user: '0xabc' })).toBe('lic-1')
  })

  it.each(cases.filter((c) => !['useIssueGrant', 'useRevokeLicense'].includes(c[0])))(
    '%s invalidates exactly the tier list for this app',
    async (_n, hook, _fn, vars) => {
      const spy = vi.spyOn(qc, 'invalidateQueries')
      await run(hook, vars)
      expect(spy.mock.calls.map((c) => c[0])).toEqual([{ queryKey: publisherKeys.types('app-1', 'did:key:z1') }])
    },
  )

  it.each([
    ['useIssueGrant', h.useIssueGrant, { appId: 'app-1', licenseTypeId: 'lt-1', user: '0xabc' }],
    ['useRevokeLicense', h.useRevokeLicense, { licenseId: 'lic-1' }],
  ] as const)('%s invalidates licences by prefix AND environments', async (_n, hook, vars) => {
    const spy = vi.spyOn(qc, 'invalidateQueries')
    await run(hook as (a: string) => unknown, vars)
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey)
    expect(keys).toContainEqual(['publisher', 'licenses', 'app-1'])
    expect(keys).toContainEqual(publisherKeys.environments('app-1', 'did:key:z1'))
  })

  it('a revoke drops a cached REVOKED-filtered list, not just ALL/ACTIVE; other apps are untouched', async () => {
    const did = 'did:key:z1'
    const revoked = publisherKeys.licenses('app-1', 'REVOKED', did)
    const all = publisherKeys.licenses('app-1', null, did)
    const other = publisherKeys.licenses('app-2', 'REVOKED', did)
    const envs = publisherKeys.environments('app-1', did)
    const types = publisherKeys.types('app-1', did)
    for (const k of [revoked, all, other, envs, types]) qc.setQueryData(k, [])
    await run(h.useRevokeLicense, { licenseId: 'lic-1' })
    expect(qc.getQueryState(revoked)?.isInvalidated).toBe(true)
    expect(qc.getQueryState(all)?.isInvalidated).toBe(true)
    expect(qc.getQueryState(envs)?.isInvalidated).toBe(true)
    expect(qc.getQueryState(other)?.isInvalidated).toBe(false)
    expect(qc.getQueryState(types)?.isInvalidated).toBe(false)
  })

  it('does not retry a failing mutation (a retried grant could issue two licences)', async () => {
    fns.issueGrant.mockRejectedValue(new Error('boom'))
    await run(h.useIssueGrant, { appId: 'app-1', licenseTypeId: 'lt-1', user: '0xabc' }).catch(() => {})
    expect(fns.issueGrant).toHaveBeenCalledTimes(1)
  })

  it('surfaces the server error unchanged and invalidates nothing', async () => {
    const msg = 'ADD_TEMPLATE_SERVICE rejected: a service of that type already exists'
    fns.addLicenseTypeService.mockRejectedValue(new Error(msg))
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const err = await run(h.useAddLicenseTypeService, { licenseTypeId: 'lt-1', type: 'X' }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe(msg)
    expect(spy).not.toHaveBeenCalled()
  })
})
