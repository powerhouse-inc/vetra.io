import { afterEach, describe, expect, it } from 'vitest'

import { isRecommended, recommendedNames } from '../recommended'

afterEach(() => {
  delete process.env.PACKAGES_RECOMMENDED
})

describe('recommendedNames', () => {
  it('returns an empty set when the env var is unset', () => {
    expect(recommendedNames().size).toBe(0)
  })

  it('returns an empty set when the env var is empty or only separators', () => {
    process.env.PACKAGES_RECOMMENDED = ''
    expect(recommendedNames().size).toBe(0)

    process.env.PACKAGES_RECOMMENDED = ',, ,'
    expect(recommendedNames().size).toBe(0)
  })

  it('splits, trims, and lowercases entries', () => {
    process.env.PACKAGES_RECOMMENDED = '@Scope/My-Pkg, other-pkg ,@Scope/My-Pkg'
    expect(recommendedNames().size).toBe(2)
    expect(recommendedNames().has('@scope/my-pkg')).toBe(true)
    expect(recommendedNames().has('other-pkg')).toBe(true)
  })
})

describe('isRecommended', () => {
  it('matches case-insensitively against registry names', () => {
    process.env.PACKAGES_RECOMMENDED = '@powerhousedao/billing,Retrospective-toolkit'
    expect(isRecommended('@powerhousedao/billing')).toBe(true)
    expect(isRecommended('@POWERHOUSEDAO/BILLING')).toBe(true)
    expect(isRecommended('retrospective-toolkit')).toBe(true)
    expect(isRecommended('@powerhousedao/invoice')).toBe(false)
    expect(isRecommended('')).toBe(false)
  })

  it('never matches when the allowlist is unset', () => {
    expect(isRecommended('@powerhousedao/billing')).toBe(false)
  })
})
