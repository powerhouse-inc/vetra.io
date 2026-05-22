'use client'

import { formatAddress, useEnsName } from '@/modules/cloud/hooks/use-ens-name'

interface Props {
  address: string
  /** Render the full hex address (with the ENS prefix when known). */
  full?: boolean
}

/**
 * Renders an Ethereum address as a friendly chip — `name.eth (0xab…cd)` when
 * the ENS lookup resolves, just `0xab…cd` otherwise. Pass `full` to render
 * the raw 0x address rather than the truncated form.
 */
export function EnsAddress({ address, full }: Props) {
  const ensName = useEnsName(address)

  if (full) {
    return <>{ensName ? `${ensName} (${address})` : address}</>
  }

  return <>{formatAddress(address, ensName)}</>
}
