import { describe, it, expect } from 'vitest'
import {
  CODE_PATTERN,
  codePlans,
  endOfDayIso,
  inviteCodeInput,
  inviteCodeSchema,
  redeemPath,
  redeemUrl,
  usesText,
} from '../lib/invite-codes'
import type { PublisherTerm } from '../types'

describe('invite codes', () => {
  it('keeps mixed case, dashes and underscores intact in the link', () => {
    expect(CODE_PATTERN.test('LFC_2026-vip')).toBe(true)
    expect(redeemPath('LFC_2026-vip')).toBe('/redeem/LFC_2026-vip')
    expect(redeemUrl('https://vetra.io/', 'LFC_2026-vip')).toBe(
      'https://vetra.io/redeem/LFC_2026-vip',
    )
  })

  it('encodes exactly once, so a path decodes back to the code', () => {
    const code = 'Mixed_Case-9'
    expect(decodeURIComponent(redeemPath(code).slice('/redeem/'.length))).toBe(code)
    expect(redeemPath('a b')).toBe('/redeem/a%20b')
    expect(redeemPath('100%')).toBe('/redeem/100%25')
  })

  it('refuses codes that would not survive a URL or are too short', () => {
    expect(CODE_PATTERN.test('abc')).toBe(false)
    // The server requires 8 to 64 characters.
    expect(CODE_PATTERN.test('VIP-2026')).toBe(true)
    expect(CODE_PATTERN.test('VIP-206')).toBe(false)
    expect(CODE_PATTERN.test('a'.repeat(64))).toBe(true)
    expect(CODE_PATTERN.test('a'.repeat(65))).toBe(false)
    expect(CODE_PATTERN.test('has space')).toBe(false)
    expect(CODE_PATTERN.test('a/b/c/d')).toBe(false)
    expect(CODE_PATTERN.test('-leading')).toBe(false)
  })

  it('expires at the end of the chosen local day', () => {
    const iso = endOfDayIso('2026-12-31')
    const d = new Date(iso)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(11)
    expect(d.getDate()).toBe(31)
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(59)
  })

  it('counts uses', () => {
    expect(usesText({ redemptions: 3, maxUses: 50 })).toBe('3 of 50')
    expect(usesText({ redemptions: 1, maxUses: null })).toBe('1 redeemed')
  })

  it('offers only published plans that allow invite codes', () => {
    const t = (o: Partial<PublisherTerm>) =>
      ({
        id: 'x',
        kind: 'k',
        label: null,
        templateId: 't',
        validityDays: null,
        issuers: ['INVITE_CODE'],
        status: 'ACTIVE',
        activeLicenses: 0,
        ...o,
      }) as PublisherTerm
    expect(
      codePlans([
        t({ id: 'a' }),
        t({ id: 'b', issuers: ['PUBLISHER_GRANT'] }),
        t({ id: 'c', status: 'RETIRED' }),
      ]).map((p) => p.id),
    ).toEqual(['a'])
  })

  it('omits the code and key when left empty, so the server generates the code', () => {
    const form = { kind: 'conf', label: '', code: '', maxUses: '', expiresOn: '', anthropicKey: '' }
    expect(inviteCodeSchema.safeParse(form).success).toBe(true)
    expect(inviteCodeInput(form)).toEqual({
      kind: 'conf',
      label: null,
      maxUses: null,
      expiresAt: null,
    })
    expect(
      inviteCodeInput({ ...form, code: ' VIP-2026 ', maxUses: '50', anthropicKey: ' sk-ant ' }),
    ).toMatchObject({
      code: 'VIP-2026',
      maxUses: 50,
      anthropicKey: 'sk-ant',
    })
  })

  it('rejects a past expiry date and a zero use cap', () => {
    const form = {
      kind: 'conf',
      label: '',
      code: '',
      maxUses: '0',
      expiresOn: '2000-01-01',
      anthropicKey: '',
    }
    const result = inviteCodeSchema.safeParse(form)
    expect(result.success).toBe(false)
    const paths = result.success ? [] : result.error.issues.map((i) => i.path[0])
    expect(paths).toEqual(expect.arrayContaining(['maxUses', 'expiresOn']))
  })

  it('caps the number of uses and explains the code length', () => {
    const form = { kind: 'conf', label: '', code: '', maxUses: '', expiresOn: '', anthropicKey: '' }
    expect(inviteCodeSchema.safeParse({ ...form, maxUses: '1000000' }).success).toBe(true)
    expect(inviteCodeSchema.safeParse({ ...form, maxUses: '1000001' }).success).toBe(false)
    const short = inviteCodeSchema.safeParse({ ...form, code: 'VIP-1' })
    expect(short.success ? '' : short.error.issues[0].message).toBe(
      '8–64 letters, numbers, dashes or underscores',
    )
  })
})
