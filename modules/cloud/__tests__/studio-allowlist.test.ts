import { describe, expect, it } from 'vitest'
import { parseAllowlist, isStudioAllowed } from '@/modules/cloud/studio/allowlist'

describe('parseAllowlist', () => {
  it('splits, trims, lowercases, drops empties', () => {
    expect(parseAllowlist('0xAbc, 0xDEF ,, ')).toEqual(['0xabc', '0xdef'])
  })
  it('returns [] for undefined/empty', () => {
    expect(parseAllowlist(undefined)).toEqual([])
    expect(parseAllowlist('')).toEqual([])
  })
})

describe('isStudioAllowed', () => {
  const list = ['0xabc', '0xdef']
  it('true when address is in the list (case-insensitive)', () => {
    expect(isStudioAllowed('0xABC', list)).toBe(true)
  })
  it('false when address missing or not listed', () => {
    expect(isStudioAllowed(null, list)).toBe(false)
    expect(isStudioAllowed('0x999', list)).toBe(false)
  })
  it('false when the allowlist is empty (closed by default)', () => {
    expect(isStudioAllowed('0xabc', [])).toBe(false)
  })
})
