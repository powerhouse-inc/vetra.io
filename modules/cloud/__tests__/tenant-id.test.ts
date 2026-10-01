import { describe, expect, it } from 'vitest'
import { getTenantId } from '../tenant-id'

// Must match vetra-cloud-package's getTenantId(): the id is the tenant
// namespace, so it is lowercase even for mixed-case document ids.
describe('getTenantId', () => {
  it('lowercases mixed-case document ids', () => {
    expect(getTenantId('vast-vole-351c8164', '8tgXdfJjQ2mZpL0aBcDe')).toBe(
      'vast-vole-351c8164-8tgxdfjj',
    )
  })

  it('keeps uuid-based ids unchanged', () => {
    expect(getTenantId('noble-fox-31bf9f74', '31bf9f74-1111-2222-3333-444455556666')).toBe(
      'noble-fox-31bf9f74-31bf9f74',
    )
  })
})
