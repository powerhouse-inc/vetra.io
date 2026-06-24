import { describe, it, expect, beforeEach } from 'vitest'
import {
  IDENTITY_MARKER_KEY,
  shouldClearForIdentity,
  readIdentityMarker,
  writeIdentityMarker,
} from '@/shared/state/identity-reset'

describe('shouldClearForIdentity', () => {
  it('clears when a stored identity differs from the resolved one', () => {
    expect(shouldClearForIdentity('did:a', 'did:b')).toBe(true)
  })

  it('does not clear when identities match', () => {
    expect(shouldClearForIdentity('did:a', 'did:a')).toBe(false)
  })

  it('does not clear on a fresh browser (no stored identity)', () => {
    expect(shouldClearForIdentity(null, 'did:b')).toBe(false)
  })

  it('does not clear while the current identity is still resolving', () => {
    expect(shouldClearForIdentity('did:a', null)).toBe(false)
  })
})

describe('identity marker storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a did', () => {
    writeIdentityMarker('did:a')
    expect(readIdentityMarker()).toBe('did:a')
    expect(localStorage.getItem(IDENTITY_MARKER_KEY)).toBe('did:a')
  })

  it('reads null when unset', () => {
    expect(readIdentityMarker()).toBeNull()
  })

  it('removes the marker when written with null', () => {
    writeIdentityMarker('did:a')
    writeIdentityMarker(null)
    expect(readIdentityMarker()).toBeNull()
  })
})
