import { describe, expect, it } from 'vitest'
import { CAPACITY_TIERS, tierFor } from '@/modules/landing/lib/pricing'

describe('capacity pricing', () => {
  it('prices one unit at 2 vCPU, 4 GB, 80 GB NVMe for €40', () => {
    expect(tierFor(1)).toMatchObject({ vcpu: 2, memoryGb: 4, nvmeGb: 80, eurPerMonth: 40 })
  })

  it('scales linearly with units', () => {
    expect(tierFor(2)).toMatchObject({ vcpu: 4, memoryGb: 8, nvmeGb: 160, eurPerMonth: 80 })
  })

  it('offers four tiers from €40 to €320', () => {
    expect(CAPACITY_TIERS.map((t) => t.eurPerMonth)).toEqual([40, 80, 160, 320])
  })

  it('rejects non-positive or fractional units', () => {
    expect(() => tierFor(0)).toThrow()
    expect(() => tierFor(1.5)).toThrow()
  })
})
