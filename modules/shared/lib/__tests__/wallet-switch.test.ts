import { afterEach, describe, expect, it } from 'vitest'
import {
  readLoginMethod,
  rememberLoginMethod,
  sameAddress,
  shortAddress,
  walletSwitchTarget,
} from '../wallet-switch'

const OLD = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const NEW = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

describe('sameAddress', () => {
  it('compares case-insensitively and rejects blanks', () => {
    expect(sameAddress(OLD, OLD.toLowerCase())).toBe(true)
    expect(sameAddress(OLD, NEW)).toBe(false)
    expect(sameAddress(undefined, OLD)).toBe(false)
    expect(sameAddress('', '')).toBe(false)
  })
})

describe('shortAddress', () => {
  it('keeps the head and tail of an address', () => {
    expect(shortAddress(NEW)).toBe('0x7099…79C8')
  })
})

describe('walletSwitchTarget', () => {
  const base = { sessionAddress: OLD, loginMethod: 'wallet' as const, dismissed: null }

  it('asks when the wallet now points at another account', () => {
    expect(walletSwitchTarget({ ...base, accounts: [NEW] })).toBe(NEW)
    // The active account is the first one the wallet lists.
    expect(walletSwitchTarget({ ...base, accounts: [NEW, OLD] })).toBe(NEW)
  })

  it('stays quiet when the active account is the signed-in one, in any case', () => {
    expect(walletSwitchTarget({ ...base, accounts: [OLD.toLowerCase()] })).toBeNull()
    expect(
      walletSwitchTarget({ ...base, accounts: [OLD.toUpperCase().replace('0X', '0x')] }),
    ).toBeNull()
  })

  it('stays quiet without a session or without wallet accounts (locked / not connected)', () => {
    expect(walletSwitchTarget({ ...base, sessionAddress: undefined, accounts: [NEW] })).toBeNull()
    expect(walletSwitchTarget({ ...base, accounts: [] })).toBeNull()
  })

  it('ignores sessions signed in with Privy email or Google', () => {
    expect(walletSwitchTarget({ ...base, loginMethod: 'email', accounts: [NEW] })).toBeNull()
    expect(walletSwitchTarget({ ...base, loginMethod: 'google', accounts: [NEW] })).toBeNull()
  })

  it('with an unknown login method, asks only when the wallet also holds the session account', () => {
    const unknown = { ...base, loginMethod: undefined }
    expect(walletSwitchTarget({ ...unknown, accounts: [NEW] })).toBeNull()
    expect(walletSwitchTarget({ ...unknown, accounts: [NEW, OLD.toLowerCase()] })).toBe(NEW)
  })

  it('respects "stay" for that account until the wallet moves to another one', () => {
    expect(
      walletSwitchTarget({ ...base, accounts: [NEW], dismissed: NEW.toLowerCase() }),
    ).toBeNull()
    const third = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
    expect(walletSwitchTarget({ ...base, accounts: [third], dismissed: NEW })).toBe(third)
  })
})

describe('login method memory', () => {
  afterEach(() => localStorage.clear())

  it('remembers the last method picked and reads back unknown values as undefined', () => {
    expect(readLoginMethod()).toBeUndefined()
    rememberLoginMethod('email')
    expect(readLoginMethod()).toBe('email')
    rememberLoginMethod('wallet')
    expect(readLoginMethod()).toBe('wallet')
    localStorage.setItem('vetra:renown-login-method', 'carrier-pigeon')
    expect(readLoginMethod()).toBeUndefined()
    rememberLoginMethod(undefined)
    expect(readLoginMethod()).toBeUndefined()
  })
})
