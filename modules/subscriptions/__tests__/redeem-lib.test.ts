import { describe, it, expect } from 'vitest'
import { redeemInput, safeDecode } from '../lib/redeem'

describe('redeem lib', () => {
  it('decodes a path segment once and survives a malformed one', () => {
    expect(safeDecode('LFC_2026-vip')).toBe('LFC_2026-vip')
    expect(safeDecode('ab%2Dc')).toBe('ab-c')
    expect(safeDecode('%E0%A4%A')).toBe('%E0%A4%A')
  })

  it('builds the input for each choice', () => {
    expect(redeemInput({ code: 'C', choice: 'new', label: ' Acme ', mode: 'DEDICATED' })).toEqual({ code: 'C', label: 'Acme' })
    expect(redeemInput({ code: 'C', choice: 'new', label: 'ignored', mode: 'SHARED' })).toEqual({ code: 'C' })
    expect(redeemInput({ code: 'C', choice: { upgrades: 'lic-1' }, label: 'x', mode: 'DEDICATED' })).toEqual({ code: 'C', upgrades: 'lic-1' })
  })
})
