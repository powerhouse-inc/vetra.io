import { describe, expect, it } from 'vitest'
import { shouldPersistQuery } from '@/shared/providers/query-client/query-client'
import { queryKeys } from '@/modules/cloud/query/keys'

describe('shouldPersistQuery', () => {
  it('persists ordinary per-user queries', () => {
    expect(shouldPersistQuery(queryKeys.environments('MINE', 'did:x'))).toBe(true)
    expect(shouldPersistQuery(queryKeys.studioProducts('did:x'))).toBe(true)
    expect(shouldPersistQuery(queryKeys.viewer('did:x'))).toBe(true)
  })

  it('never persists sensitive tenant queries', () => {
    expect(shouldPersistQuery(queryKeys.tenantSecrets('env-1'))).toBe(false)
    expect(shouldPersistQuery(queryKeys.tenantEnvVars('env-1'))).toBe(false)
  })

  it('persists keys with a non-string head (cannot match a sensitive prefix)', () => {
    expect(shouldPersistQuery([42, 'x'])).toBe(true)
  })
})

describe('queryKeys', () => {
  it('namespaces per-user keys by DID so different users get different buckets', () => {
    expect(queryKeys.environments('MINE', 'did:a')).not.toEqual(
      queryKeys.environments('MINE', 'did:b'),
    )
    expect(queryKeys.viewer('did:a')).not.toEqual(queryKeys.viewer('did:b'))
  })

  it('keys the env list by the active organisation', () => {
    expect(queryKeys.environments('ORG', 'did:x', 'o1')).toEqual([
      'environments',
      'ORG',
      'did:x',
      'o1',
    ])
    expect(queryKeys.environmentOrg('e1', undefined)).toEqual(['environment-org', 'e1', null])
  })

  it('normalizes an undefined DID to a stable anonymous bucket', () => {
    expect(queryKeys.environments('MINE', undefined)).toEqual(['environments', 'MINE', null, null])
    expect(queryKeys.studioProducts(undefined)).toEqual(['studio-products', null])
  })

  it('separates scopes within the same identity', () => {
    expect(queryKeys.environments('MINE', 'did:a')).not.toEqual(
      queryKeys.environments('ALL', 'did:a'),
    )
  })
})
