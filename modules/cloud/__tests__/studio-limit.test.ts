import { afterEach, describe, expect, it } from 'vitest'
import { maxStudiosPerUser } from '@/modules/cloud/switchboard-url'

type WindowWithEnv = { __ENV?: Record<string, string> }

function setEnv(value: string | undefined) {
  const w = window as unknown as WindowWithEnv
  w.__ENV = value === undefined ? {} : { NEXT_PUBLIC_MAX_STUDIOS_PER_USER: value }
}

afterEach(() => {
  delete (window as unknown as WindowWithEnv).__ENV
})

describe('maxStudiosPerUser', () => {
  it('returns 0 (no limit) when unset', () => {
    setEnv(undefined)
    expect(maxStudiosPerUser()).toBe(0)
  })

  it('parses a positive integer', () => {
    setEnv('3')
    expect(maxStudiosPerUser()).toBe(3)
  })

  it('treats "0" as no limit', () => {
    setEnv('0')
    expect(maxStudiosPerUser()).toBe(0)
  })

  it('treats a negative value as no limit', () => {
    setEnv('-2')
    expect(maxStudiosPerUser()).toBe(0)
  })

  it('treats a non-numeric value as no limit', () => {
    setEnv('abc')
    expect(maxStudiosPerUser()).toBe(0)
  })
})
