import { describe, expect, it, vi } from 'vitest'

import { waitForToken } from '@/modules/apps/lib/token'

describe('waitForToken', () => {
  it('returns the token as soon as Renown can mint one', async () => {
    const mint = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue('tok')
    await expect(waitForToken(mint, { timeoutMs: 1000, intervalMs: 1 })).resolves.toBe('tok')
    expect(mint).toHaveBeenCalledTimes(3)
  })

  it('gives up with null after the timeout instead of hanging', async () => {
    const mint = vi.fn().mockResolvedValue(null)
    await expect(waitForToken(mint, { timeoutMs: 20, intervalMs: 5 })).resolves.toBeNull()
    expect(mint.mock.calls.length).toBeGreaterThan(1)
  })

  it('treats a throwing minter like "not ready yet"', async () => {
    const mint = vi
      .fn()
      .mockRejectedValueOnce(new Error('keypair not loaded'))
      .mockResolvedValue('tok')
    await expect(waitForToken(mint, { timeoutMs: 1000, intervalMs: 1 })).resolves.toBe('tok')
  })
})

import { AppsApiError } from '@/modules/apps/graphql'
import { retryUnlessFinal } from '@/modules/apps/hooks/use-apps'

describe('retryUnlessFinal', () => {
  it('retries UNAUTHENTICATED twice (session still warming up after a redirect)', () => {
    const err = new AppsApiError('UNAUTHENTICATED', 'x', 401)
    expect(retryUnlessFinal(0, err)).toBe(true)
    expect(retryUnlessFinal(1, err)).toBe(true)
    expect(retryUnlessFinal(2, err)).toBe(false)
  })

  it('never retries final errors like FORBIDDEN', () => {
    expect(retryUnlessFinal(0, new AppsApiError('FORBIDDEN', 'x', 403))).toBe(false)
  })
})
