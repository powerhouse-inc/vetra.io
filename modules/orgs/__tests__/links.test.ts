import { describe, expect, it } from 'vitest'
import {
  renownCreateOrgUrl,
  renownMeUrl,
  renownOrgBringAppUrl,
  renownOrgManageUrl,
  renownOrgPageUrl,
} from '../lib/links'

describe('renown.id org links (handle-based)', () => {
  it('builds the binding routes', () => {
    const base = 'https://www.renown.id'
    expect(renownOrgManageUrl('acme', 'members')).toBe(`${base}/org/acme/manage/members`)
    expect(renownOrgManageUrl('acme', 'oidc')).toBe(`${base}/org/acme/manage/oidc`)
    expect(renownOrgBringAppUrl('acme', 'did:key:zShop')).toBe(
      `${base}/org/acme/manage/apps?bring=did%3Akey%3AzShop`,
    )
    expect(renownMeUrl('organisations')).toBe(`${base}/me#organisations`)
    expect(renownMeUrl('app-transfers')).toBe(`${base}/me#app-transfers`)
    expect(renownCreateOrgUrl()).toBe(`${base}/org/new`)
    expect(renownOrgPageUrl('acme')).toBe(`${base}/@acme`)
  })
})
