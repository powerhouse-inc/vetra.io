import { describe, expect, it } from 'vitest'
import { deriveEmbedStatus, type EmbedStatusInputs } from '@/modules/cloud/studio/embed-status'

const base: EmbedStatusInputs = {
  authed: true,
  address: '0xme',
  allowed: true,
  resolution: 'found',
  endpointsChecked: true,
  websiteReady: true,
  reachable: true,
}

describe('deriveEmbedStatus', () => {
  it('unauthenticated when not authed', () => {
    expect(deriveEmbedStatus({ ...base, authed: false })).toBe('unauthenticated')
  })
  it('loading (not not-allowed) while the viewer address is still resolving', () => {
    expect(deriveEmbedStatus({ ...base, allowed: false, address: null })).toBe('loading')
  })
  it('not-allowed once an address is known but not on the allowlist', () => {
    expect(deriveEmbedStatus({ ...base, allowed: false, address: '0xme' })).toBe('not-allowed')
  })
  it('loading while the env is still being resolved (never not-found)', () => {
    expect(deriveEmbedStatus({ ...base, resolution: 'pending' })).toBe('loading')
  })
  it('not-found only after the env was actually resolved as missing', () => {
    expect(deriveEmbedStatus({ ...base, resolution: 'not-found' })).toBe('not-found')
  })
  it('loading (not booting) before readiness has been checked', () => {
    expect(deriveEmbedStatus({ ...base, websiteReady: false, endpointsChecked: false })).toBe(
      'loading',
    )
  })
  it('booting once checked and the agent is not serving yet', () => {
    expect(deriveEmbedStatus({ ...base, websiteReady: false, endpointsChecked: true })).toBe(
      'booting',
    )
  })
  it('booting when the agent is up but the host is not browser-reachable yet (DNS/TLS)', () => {
    expect(deriveEmbedStatus({ ...base, websiteReady: true, reachable: false })).toBe('booting')
  })
  it('ready only when serving AND reachable', () => {
    expect(deriveEmbedStatus(base)).toBe('ready')
  })
})
