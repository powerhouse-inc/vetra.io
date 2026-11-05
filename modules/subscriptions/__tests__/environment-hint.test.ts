import { describe, expect, it } from 'vitest'
import { environmentHint, withDisplayDates } from '../lib/subscriptions'

describe('environmentHint', () => {
  it('is the first DNS label of a dedicated environment URL', () => {
    expect(
      environmentHint({ mode: 'DEDICATED', openUrl: 'https://fair-bull-b6t7wwqr.vetra.io/' }),
    ).toBe('fair-bull-b6t7wwqr')
  })

  it('is null for shared subscriptions, missing or broken URLs', () => {
    expect(environmentHint({ mode: 'SHARED', openUrl: 'https://studio.vetra.io' })).toBeNull()
    expect(environmentHint({ mode: 'DEDICATED', openUrl: null })).toBeNull()
    expect(environmentHint({ mode: 'DEDICATED', openUrl: 'not a url' })).toBeNull()
  })
})

describe('withDisplayDates', () => {
  it('rewrites ISO dates in server messages', () => {
    expect(
      withDisplayDates('Your environment stops on 2026-11-16. Renew to keep it running.'),
    ).toBe('Your environment stops on Nov 16, 2026. Renew to keep it running.')
  })
})
