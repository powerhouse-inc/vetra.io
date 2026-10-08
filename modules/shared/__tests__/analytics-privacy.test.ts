import { describe, it, expect } from 'vitest'
import {
  OPENPANEL_FILTER_JS,
  SCRUB_URL_JS,
  UMAMI_BEFORE_SEND,
  UMAMI_BEFORE_SEND_JS,
} from '../lib/analytics-privacy'

// Runs the exact source the layout inlines, as the browser would.
type Fn = (...args: unknown[]) => unknown
// eslint-disable-next-line @typescript-eslint/no-implied-eval -- evaluating the inlined source is the point
const compile = (args: string[], body: string) => new Function(...args, body) as Fn
const evaluate = <T>(src: string): T => compile([], `return (${src})`)() as T
const scrub = evaluate<(u: unknown) => unknown>(SCRUB_URL_JS)

describe('analytics privacy', () => {
  it('hides the invite code in paths and full URLs', () => {
    expect(scrub('/redeem/LFC_2026-vip')).toBe('/redeem/[code]')
    expect(scrub('/redeem/KV-PILOT?utm=x#top')).toBe('/redeem/[code]?utm=x#top')
    expect(scrub('/redeem/a%20b/')).toBe('/redeem/[code]/')
    expect(scrub('https://vetra.io/redeem/SECRET-CODE')).toBe('https://vetra.io/redeem/[code]')
    expect(scrub('http://localhost:3100/redeem/X12345678')).toBe(
      'http://localhost:3100/redeem/[code]',
    )
  })

  it('leaves every other page, and non-strings, alone', () => {
    expect(scrub('/redeem')).toBe('/redeem')
    expect(scrub('/redeem/')).toBe('/redeem/')
    expect(scrub('/user/subscriptions')).toBe('/user/subscriptions')
    expect(scrub('/docs/redeem/how')).toBe('/docs/redeem/how')
    expect(scrub('https://example.com/a/redeem/b')).toBe('https://example.com/a/redeem/b')
    expect(scrub('')).toBe('')
    expect(scrub(undefined)).toBeUndefined()
  })

  it('Umami: scrubs the page URL and the referrer before sending', () => {
    const win: Record<string, unknown> = {}
    compile(['window'], UMAMI_BEFORE_SEND_JS)(win)
    const beforeSend = win[UMAMI_BEFORE_SEND] as (t: string, p: unknown) => unknown
    expect(
      beforeSend('event', {
        website: 'w',
        url: '/redeem/KV-PILOT',
        referrer: 'https://vetra.io/redeem/OTHER',
        title: 'Redeem a code · Vetra',
      }),
    ).toEqual({
      website: 'w',
      url: '/redeem/[code]',
      referrer: 'https://vetra.io/redeem/[code]',
      title: 'Redeem a code · Vetra',
    })
    expect(beforeSend('event', { url: '/user' })).toEqual({ url: '/user', referrer: undefined })
  })

  it('OpenPanel: scrubs the screen-view path and referrer, and never drops an event', () => {
    const filter = evaluate<(e: unknown) => boolean>(OPENPANEL_FILTER_JS)
    const event = {
      type: 'track',
      payload: {
        name: 'screen_view',
        properties: {
          __path: 'https://vetra.io/redeem/KV-PILOT',
          __referrer: 'https://vetra.io/redeem/OLD',
          __title: 'Redeem a code · Vetra',
        },
      },
    }
    expect(filter(event)).toBe(true)
    expect(event.payload.properties).toEqual({
      __path: 'https://vetra.io/redeem/[code]',
      __referrer: 'https://vetra.io/redeem/[code]',
      __title: 'Redeem a code · Vetra',
    })
    const click = {
      type: 'track',
      payload: { name: 'link_out', properties: { href: 'https://x' } },
    }
    expect(filter(click)).toBe(true)
    expect(click.payload.properties).toEqual({ href: 'https://x' })
    expect(filter({ type: 'identify', payload: { profileId: 'p' } })).toBe(true)
  })
})
