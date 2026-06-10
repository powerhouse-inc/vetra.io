import { describe, expect, it } from 'vitest'

import {
  computeDistTags,
  sortTagsNewestFirst,
  toServiceImageTag,
} from '@/modules/cloud/registry/channels'

describe('computeDistTags', () => {
  it('returns empty object for empty input', () => {
    expect(computeDistTags([])).toEqual({})
  })

  it('picks the highest .N for a single dev channel', () => {
    const tags = ['v6.0.0-dev.225', 'v6.0.0-dev.240', 'v6.0.0-dev.236']
    expect(computeDistTags(tags)).toEqual({ dev: 'v6.0.0-dev.240' })
  })

  it('handles dev + stable together', () => {
    const tags = ['v6.0.0-dev.240', 'v5.4.2', 'v5.3.6', 'v5.4.0-dev.10']
    expect(computeDistTags(tags)).toEqual({
      dev: 'v6.0.0-dev.240',
      latest: 'v5.4.2',
    })
  })

  it('auto-discovers new channels (beta)', () => {
    const tags = ['v6.0.0-beta.3', 'v6.0.0-beta.1', 'v6.0.0-dev.5']
    expect(computeDistTags(tags)).toEqual({
      beta: 'v6.0.0-beta.3',
      dev: 'v6.0.0-dev.5',
    })
  })

  it('compares across major.minor.patch (newer base wins)', () => {
    const tags = ['v5.99.0-dev.999', 'v6.0.0-dev.1']
    expect(computeDistTags(tags)).toEqual({ dev: 'v6.0.0-dev.1' })
  })

  it('stable beats same-base prerelease for latest', () => {
    const tags = ['v6.0.0', 'v6.0.0-dev.99']
    expect(computeDistTags(tags)).toEqual({
      latest: 'v6.0.0',
      dev: 'v6.0.0-dev.99',
    })
  })

  it('ignores unrecognized tags', () => {
    const tags = ['latest', 'staging', 'sha256-abc', 'v6.0.0-dev.240']
    expect(computeDistTags(tags)).toEqual({ dev: 'v6.0.0-dev.240' })
  })

  it('handles tags without the v prefix', () => {
    expect(computeDistTags(['6.0.0-dev.5', '6.0.0-dev.10'])).toEqual({
      dev: '6.0.0-dev.10',
    })
  })

  it('channel detection is case-insensitive (BETA == beta)', () => {
    expect(computeDistTags(['v6.0.0-BETA.1', 'v6.0.0-beta.2'])).toEqual({
      beta: 'v6.0.0-beta.2',
    })
  })
})

describe('sortTagsNewestFirst', () => {
  it('returns empty for empty input', () => {
    expect(sortTagsNewestFirst([])).toEqual([])
  })

  it('sorts semver tags newest-first within a channel', () => {
    expect(sortTagsNewestFirst(['v6.0.0-dev.225', 'v6.0.0-dev.240', 'v6.0.0-dev.236'])).toEqual([
      'v6.0.0-dev.240',
      'v6.0.0-dev.236',
      'v6.0.0-dev.225',
    ])
  })

  it('orders by base version then bump', () => {
    expect(sortTagsNewestFirst(['v5.99.0-dev.999', 'v6.0.0-dev.1', 'v6.0.0-dev.10'])).toEqual([
      'v6.0.0-dev.10',
      'v6.0.0-dev.1',
      'v5.99.0-dev.999',
    ])
  })

  it('keeps stable above same-base prerelease', () => {
    expect(sortTagsNewestFirst(['v6.0.0-dev.99', 'v6.0.0'])).toEqual(['v6.0.0', 'v6.0.0-dev.99'])
  })

  it('floating Docker tags (unmatched) bubble to the top', () => {
    expect(sortTagsNewestFirst(['v5.0.0', 'dev', 'staging', 'v6.0.0-dev.10'])).toEqual([
      'dev',
      'staging',
      'v6.0.0-dev.10',
      'v5.0.0',
    ])
  })
})

describe('toServiceImageTag', () => {
  it('prefixes bare semver with v', () => {
    expect(toServiceImageTag('1.2.3')).toBe('v1.2.3')
    expect(toServiceImageTag('6.0.0-dev.240')).toBe('v6.0.0-dev.240')
  })

  it('leaves already-prefixed semver untouched', () => {
    expect(toServiceImageTag('v1.2.3')).toBe('v1.2.3')
  })

  it('does not prefix floating Docker tags', () => {
    expect(toServiceImageTag('latest')).toBe('latest')
    expect(toServiceImageTag('dev')).toBe('dev')
    expect(toServiceImageTag('staging')).toBe('staging')
  })
})
