import { describe, expect, it, vi } from 'vitest'

vi.mock('@powerhousedao/reactor-browser', () => ({ useRenownAuth: vi.fn() }))
vi.mock('@/modules/shared/hooks/use-renown-avatar', () => ({ useRenownAvatarUrl: vi.fn() }))

import { realEnsName } from '../settings-tab'

describe('realEnsName', () => {
  it('drops the shortened address Renown uses when there is no ENS name', () => {
    expect(realEnsName('0x2BbE…3aC6')).toBeNull()
    expect(realEnsName('0x2BbE...3aC6')).toBeNull()
    expect(realEnsName(null)).toBeNull()
  })
  it('keeps a real name', () => {
    expect(realEnsName('frank.eth')).toBe('frank.eth')
  })
})
