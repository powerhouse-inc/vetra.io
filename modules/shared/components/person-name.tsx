'use client'

import { usePersonName } from '@/modules/shared/hooks/use-person-name'

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/**
 * A person, by Renown profile name (else ENS name, else the short address), with the full
 * address as a tooltip. Anything that is not an address or did:pkh is shown as given.
 */
export function PersonName({ value, className }: { value: string; className?: string }) {
  const { name, address } = usePersonName(value)
  if (!address) return <span className={className}>{value}</span>
  return (
    <span title={address} className={className}>
      {name ?? shortAddress(address)}
    </span>
  )
}
