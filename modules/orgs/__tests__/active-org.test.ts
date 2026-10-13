import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ACTIVE_ORG_KEY,
  readActiveOrg,
  resolveActiveOrgId,
  subscribeActiveOrg,
  writeActiveOrg,
} from '../active-org'
import type { MyOrg } from '../types'

const acme: MyOrg = {
  id: 'o1',
  did: 'did:web:x:org:o1',
  handle: 'acme',
  name: 'Acme',
  avatar: null,
  verifiedDomains: [],
  role: 'PUBLISHER',
}

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('active org store', () => {
  it('reads, writes and clears the stored org and notifies subscribers', () => {
    const cb = vi.fn()
    const off = subscribeActiveOrg(cb)
    writeActiveOrg('o1')
    expect(window.localStorage.getItem(ACTIVE_ORG_KEY)).toBe('o1')
    expect(readActiveOrg()).toBe('o1')
    writeActiveOrg(null)
    expect(readActiveOrg()).toBeNull()
    expect(cb).toHaveBeenCalledTimes(2)
    off()
    writeActiveOrg('o2')
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('treats unusable storage as personal', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(readActiveOrg()).toBeNull()
    expect(() => writeActiveOrg('o1')).not.toThrow()
  })
})

describe('resolveActiveOrgId', () => {
  it('keeps the stored org while memberships load', () => {
    expect(resolveActiveOrgId('o1', undefined, false)).toBe('o1')
  })
  it('falls back to personal once the memberships say so', () => {
    expect(resolveActiveOrgId('o1', [acme], false)).toBe('o1')
    expect(resolveActiveOrgId('o9', [acme], false)).toBeNull()
  })
  it('lookup failed → personal; nothing stored → personal', () => {
    expect(resolveActiveOrgId('o1', undefined, true)).toBeNull()
    expect(resolveActiveOrgId(null, [acme], false)).toBeNull()
  })
})
