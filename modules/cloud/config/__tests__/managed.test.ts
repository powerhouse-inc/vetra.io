import { describe, expect, it } from 'vitest'
import { MANAGED_SECRET_KEYS, withoutManagedConfig } from '../managed'

describe('withoutManagedConfig', () => {
  it('drops managed keys and keeps every other entry and field', () => {
    const manifest = {
      name: '@powerhousedao/workflow',
      config: [
        { name: 'PH_WORKFLOWS_SECRETS_MASTER_KEY', type: 'secret' },
        { name: 'PH_WORKFLOWS_RUN_CONCURRENCY', type: 'var', default: '4' },
      ],
    }
    expect(withoutManagedConfig(manifest)).toEqual({
      name: '@powerhousedao/workflow',
      config: [{ name: 'PH_WORKFLOWS_RUN_CONCURRENCY', type: 'var', default: '4' }],
    })
  })

  it('returns manifests without a config array untouched', () => {
    const manifest = { name: 'x' }
    expect(withoutManagedConfig(manifest)).toBe(manifest)
    expect(withoutManagedConfig(null)).toBeNull()
  })

  it('manages the workflows master key', () => {
    expect(MANAGED_SECRET_KEYS.has('PH_WORKFLOWS_SECRETS_MASTER_KEY')).toBe(true)
  })
})
