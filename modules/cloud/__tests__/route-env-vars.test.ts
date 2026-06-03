import { describe, it, expect } from 'vitest'
import { routeEnvVars } from '@/modules/cloud/config/route-env-vars'

describe('routeEnvVars', () => {
  it('routes secret rows with a value to tenant_secrets, document gets the name+isSecret only', () => {
    const result = routeEnvVars([
      { name: 'API_KEY', value: 'sk-live-123', isSecret: true },
    ])
    expect(result.secretsToPersist).toEqual([{ name: 'API_KEY', value: 'sk-live-123' }])
    expect(result.envForDocument).toEqual([
      { name: 'API_KEY', value: null, isSecret: true },
    ])
  })

  it('routes plain rows inline; document carries the value', () => {
    const result = routeEnvVars([
      { name: 'LOG_LEVEL', value: 'debug', isSecret: false },
    ])
    expect(result.secretsToPersist).toEqual([])
    expect(result.envForDocument).toEqual([
      { name: 'LOG_LEVEL', value: 'debug', isSecret: false },
    ])
  })

  it('treats undefined/null isSecret as plain', () => {
    const result = routeEnvVars([{ name: 'X', value: 'y' }])
    expect(result.secretsToPersist).toEqual([])
    expect(result.envForDocument).toEqual([{ name: 'X', value: 'y', isSecret: false }])
  })

  it('preserves existing stored secret when user leaves the value empty (no setTenantSecret call queued)', () => {
    // Simulates loading a secret row from the document where value=null/empty:
    // the actual encrypted value is already in tenant_secrets; the user has
    // not typed a replacement; no upsert is needed.
    const result = routeEnvVars([
      { name: 'API_KEY', value: null, isSecret: true },
      { name: 'API_KEY_2', value: '', isSecret: true },
    ])
    expect(result.secretsToPersist).toEqual([])
    expect(result.envForDocument).toEqual([
      { name: 'API_KEY', value: null, isSecret: true },
      { name: 'API_KEY_2', value: null, isSecret: true },
    ])
  })

  it('drops empty-name rows from both outputs', () => {
    const result = routeEnvVars([
      { name: '', value: 'orphan', isSecret: false },
      { name: '   ', value: 'whitespace', isSecret: true },
      { name: 'KEEP', value: 'me' },
    ])
    expect(result.secretsToPersist).toEqual([])
    expect(result.envForDocument).toEqual([{ name: 'KEEP', value: 'me', isSecret: false }])
  })

  it('mixed batch: routes each row to the right path independently', () => {
    const result = routeEnvVars([
      { name: 'PUBLIC_VAR', value: 'visible', isSecret: false },
      { name: 'DB_PASSWORD', value: 'topsecret', isSecret: true },
      { name: 'TIMEOUT_MS', value: '5000' },
      { name: 'OLD_SECRET', value: null, isSecret: true },
    ])
    expect(result.secretsToPersist).toEqual([
      { name: 'DB_PASSWORD', value: 'topsecret' },
    ])
    expect(result.envForDocument).toEqual([
      { name: 'PUBLIC_VAR', value: 'visible', isSecret: false },
      { name: 'DB_PASSWORD', value: null, isSecret: true },
      { name: 'TIMEOUT_MS', value: '5000', isSecret: false },
      { name: 'OLD_SECRET', value: null, isSecret: true },
    ])
  })

  it('trims the name and value of secret rows before persisting', () => {
    const result = routeEnvVars([
      { name: '  PADDED  ', value: '  trim-me  ', isSecret: true },
    ])
    expect(result.secretsToPersist).toEqual([{ name: 'PADDED', value: 'trim-me' }])
    expect(result.envForDocument).toEqual([
      { name: 'PADDED', value: null, isSecret: true },
    ])
  })
})
