'use client'

import { formatAddress } from '@/modules/cloud/hooks/use-ens-name'
import { usePersonName } from '@/modules/shared/hooks/use-person-name'

interface Props {
  address: string
  /** Render the full hex address (with the name prefix when known). */
  full?: boolean
}

/**
 * Renders an Ethereum address as a friendly chip — `Frank (0xab…cd)` with the person's Renown
 * name (else ENS name) when known, just `0xab…cd` otherwise. Pass `full` to render the raw 0x
 * address rather than the truncated form. Permission views keep the address beside the name.
 */
export function EnsAddress({ address, full }: Props) {
  const { name } = usePersonName(address)

  if (full) {
    return <>{name ? `${name} (${address})` : address}</>
  }

  return <>{formatAddress(address, name)}</>
}
