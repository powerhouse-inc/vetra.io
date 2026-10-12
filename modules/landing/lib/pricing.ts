/**
 * Vetra Cloud pricing: linear resource bundles. The solution and installed
 * packages decide how many units an environment needs.
 */
export const UNIT = { vcpu: 2, memoryGb: 4, nvmeGb: 80, eurPerMonth: 40 } as const

export type CapacityTier = {
  units: number
  vcpu: number
  memoryGb: number
  nvmeGb: number
  eurPerMonth: number
  fit: string
}

const FITS: Record<number, string> = {
  1: 'A workspace and a few packages',
  2: 'Several packages and an agent',
  4: 'Document processing add-ons',
  8: 'Heavy processing and 3D data',
}

export function tierFor(units: number): CapacityTier {
  if (!Number.isInteger(units) || units < 1) {
    throw new RangeError(`units must be a positive integer, got ${units}`)
  }
  return {
    units,
    vcpu: UNIT.vcpu * units,
    memoryGb: UNIT.memoryGb * units,
    nvmeGb: UNIT.nvmeGb * units,
    eurPerMonth: UNIT.eurPerMonth * units,
    fit: FITS[units] ?? '',
  }
}

export const CAPACITY_TIERS: CapacityTier[] = [1, 2, 4, 8].map(tierFor)
