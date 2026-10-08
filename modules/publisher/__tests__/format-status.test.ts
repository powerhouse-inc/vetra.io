import { describe, it, expect } from 'vitest'
import { dateRange, envCountText, shortDid, templateName, termName, validityText } from '../lib/format'
import { inviteCodeState, licenseStatusMeta, termStatusMeta } from '../lib/status'

describe('format', () => {
  it('shortens did:pkh and bare addresses to 0x1234…abcd', () => {
    const addr = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'
    expect(shortDid(`did:pkh:eip155:1:${addr}`)).toBe('0xAbCd…Ef01')
    expect(shortDid(addr)).toBe('0xAbCd…Ef01')
    expect(shortDid('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK')).toBe('did:key:z6Mk…ta2doK')
  })

  it('names plans and templates without ever showing an empty string', () => {
    expect(termName({ label: 'Free', kind: '2026-free' })).toBe('Free')
    expect(termName({ label: '  ', kind: '2026-free' })).toBe('2026-free')
    expect(templateName({ name: null, mode: 'SHARED' })).toBe('Untitled shared template')
    expect(templateName({ name: 'Pro', mode: 'DEDICATED' })).toBe('Pro')
  })

  it('reads validity and counts like a sentence', () => {
    expect(validityText(null)).toBe('No end date')
    expect(validityText(1)).toBe('1 day')
    expect(validityText(30)).toBe('30 days')
    expect(envCountText(0)).toBe('No environments yet')
    expect(envCountText(1)).toBe('1 environment')
    expect(envCountText(4)).toBe('4 environments')
  })

  it('formats an open-ended range', () => {
    expect(dateRange(null, null)).toBe('Not started')
    expect(dateRange('2026-10-01T00:00:00Z', null)).toMatch(/2026 – no end date$/)
  })
})

describe('status meta', () => {
  it('labels every term and licence status, and passes unknown ones through', () => {
    expect(termStatusMeta('DRAFT').label).toBe('Draft')
    expect(termStatusMeta('ACTIVE')).toMatchObject({ label: 'Published', tone: 'success' })
    expect(termStatusMeta('RETIRED').label).toBe('Retired')
    expect(licenseStatusMeta('ISSUED')).toMatchObject({ label: 'Setting up', active: true })
    expect(licenseStatusMeta('REPLACED').label).toBe('Replaced')
    expect(licenseStatusMeta('WEIRD').label).toBe('WEIRD')
  })

  it('derives an invite code state: paused beats expired beats used up', () => {
    const now = new Date('2026-10-08T12:00:00Z')
    const base = { active: true, expiresAt: null, maxUses: null, redemptions: 0 }
    expect(inviteCodeState(base, now)).toBe('active')
    expect(inviteCodeState({ ...base, active: false, expiresAt: '2026-01-01T00:00:00Z' }, now)).toBe('paused')
    expect(inviteCodeState({ ...base, expiresAt: '2026-10-08T11:59:59Z' }, now)).toBe('expired')
    expect(inviteCodeState({ ...base, maxUses: 3, redemptions: 3 }, now)).toBe('used-up')
    expect(inviteCodeState({ ...base, maxUses: 3, redemptions: 2 }, now)).toBe('active')
  })
})
