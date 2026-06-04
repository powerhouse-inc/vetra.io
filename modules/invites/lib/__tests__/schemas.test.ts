import { describe, expect, it } from 'vitest'
import {
  redeemBodySchema,
  statusBodySchema,
  validateBodySchema,
} from '@/modules/invites/lib/schemas'
import { CODE_MAX_LENGTH } from '@/modules/invites/lib/constants'

describe('validateBodySchema', () => {
  it('accepts a non-empty code', () => {
    const result = validateBodySchema.safeParse({ code: 'local-first' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.code).toBe('local-first')
  })

  it('trims surrounding whitespace', () => {
    const result = validateBodySchema.safeParse({ code: '  local-first  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.code).toBe('local-first')
  })

  it('rejects empty or whitespace-only codes', () => {
    expect(validateBodySchema.safeParse({ code: '' }).success).toBe(false)
    expect(validateBodySchema.safeParse({ code: '   ' }).success).toBe(false)
  })

  it('rejects a missing code', () => {
    expect(validateBodySchema.safeParse({}).success).toBe(false)
  })

  it(`accepts up to ${CODE_MAX_LENGTH} chars and rejects beyond`, () => {
    expect(validateBodySchema.safeParse({ code: 'a'.repeat(CODE_MAX_LENGTH) }).success).toBe(true)
    expect(validateBodySchema.safeParse({ code: 'a'.repeat(CODE_MAX_LENGTH + 1) }).success).toBe(
      false,
    )
  })
})

describe('redeemBodySchema', () => {
  it('requires both code and token', () => {
    expect(redeemBodySchema.safeParse({ code: 'x', token: 'y' }).success).toBe(true)
    expect(redeemBodySchema.safeParse({ code: 'x' }).success).toBe(false)
    expect(redeemBodySchema.safeParse({ token: 'y' }).success).toBe(false)
    expect(redeemBodySchema.safeParse({ code: 'x', token: '' }).success).toBe(false)
  })
})

describe('statusBodySchema', () => {
  it('requires a token', () => {
    expect(statusBodySchema.safeParse({ token: 'y' }).success).toBe(true)
    expect(statusBodySchema.safeParse({}).success).toBe(false)
    expect(statusBodySchema.safeParse({ token: '' }).success).toBe(false)
  })
})
