import { describe, expect, it, vi } from 'vitest'

import {
  AppsApiError,
  fetchAppAccess,
  fetchAppAudit,
  fetchAppRoles,
  removeAppRole,
  setAppRole,
  type FetchLike,
} from '@/modules/apps/graphql'
import {
  LEGACY_ACCESS,
  NO_ACCESS,
  parseRoleAddress,
  resolveAccess,
} from '@/modules/apps/lib/access'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ok = (data: unknown) => vi.fn<FetchLike>(() => Promise.resolve(jsonResponse({ data })))

function sent(fetchImpl: ReturnType<typeof vi.fn<FetchLike>>) {
  const init = fetchImpl.mock.calls[0][1]
  return JSON.parse(init.body as string) as { query: string; variables: Record<string, unknown> }
}

const ROLE = {
  appId: 'app-1',
  address: '0x' + 'a'.repeat(40),
  role: 'release_manager',
  grantedBy: '0x' + 'b'.repeat(40),
  grantedAt: '2026-11-12T00:00:00Z',
}

describe('audit and roles API', () => {
  it('fetchAppAudit pages with limit and before, and selects every entry field', async () => {
    const page = { entries: [], nextBefore: 'c2' }
    const fetchImpl = ok({ appAudit: page })
    expect(await fetchAppAudit('app-1', 50, 'c1', 'tok', fetchImpl)).toEqual(page)
    const { query, variables } = sent(fetchImpl)
    expect(variables).toEqual({ appId: 'app-1', limit: 50, before: 'c1' })
    for (const f of ['id', 'at', 'actor', 'source', 'action', 'subject', 'detail', 'nextBefore'])
      expect(query).toContain(f)
  })

  it('fetchAppRoles and fetchAppAccess select their fields', async () => {
    const roles = ok({ appRoles: [ROLE] })
    expect(await fetchAppRoles('app-1', 'tok', roles)).toEqual([ROLE])
    for (const f of Object.keys(ROLE)) expect(sent(roles).query).toContain(f)
    const access = { operate: false, release: true, administer: false, releaseManager: true }
    const accessFetch = ok({ appAccess: access })
    expect(await fetchAppAccess('app-1', 'tok', accessFetch)).toEqual(access)
    for (const f of Object.keys(access)) expect(sent(accessFetch).query).toContain(f)
  })

  it('setAppRole and removeAppRole send the app and the address', async () => {
    const set = ok({ setAppRole: ROLE })
    expect(await setAppRole('app-1', ROLE.address, 'tok', set)).toEqual(ROLE)
    expect(sent(set).variables).toEqual({ appId: 'app-1', address: ROLE.address })
    const remove = ok({ removeAppRole: true })
    expect(await removeAppRole('app-1', ROLE.address, 'tok', remove)).toBe(true)
    expect(sent(remove).query).toContain('removeAppRole')
  })
})

describe('resolveAccess', () => {
  const access = { operate: true, release: true, administer: true, releaseManager: false }
  it('uses the answer, and waits while loading', () => {
    expect(resolveAccess({ data: access, error: null, isPending: false })).toEqual({
      access,
      supported: true,
    })
    expect(resolveAccess({ data: undefined, error: null, isPending: true }).access).toBeNull()
  })
  it('treats an error as no access', () => {
    const error = new AppsApiError('FORBIDDEN', 'no')
    expect(resolveAccess({ data: undefined, error, isPending: false }).access).toEqual(NO_ACCESS)
  })
  it('keeps the page as it was on a backend without appAccess', () => {
    const error = new AppsApiError('APPS_UNAVAILABLE', 'Cannot query field "appAccess"')
    expect(resolveAccess({ data: undefined, error, isPending: false })).toEqual({
      access: LEGACY_ACCESS,
      supported: false,
    })
  })
})

describe('parseRoleAddress', () => {
  const a = '0x' + 'Ab'.repeat(20)
  it('accepts an address or a did:pkh, lower-cased', () => {
    expect(parseRoleAddress(` ${a} `)).toBe(a.toLowerCase())
    expect(parseRoleAddress(`did:pkh:eip155:1:${a}`)).toBe(a.toLowerCase())
  })
  it('refuses anything else', () => {
    expect(parseRoleAddress('0x123')).toBeNull()
    expect(parseRoleAddress('frank.eth')).toBeNull()
    expect(parseRoleAddress('did:key:z6Mk')).toBeNull()
    expect(parseRoleAddress(`${a}0`)).toBeNull()
  })
})
