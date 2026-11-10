'use client'

import { useQuery } from '@tanstack/react-query'
import { useEnsName } from '@/modules/cloud/hooks/use-ens-name'
import { addressOf, fetchRenownPerson, personName } from '@/modules/shared/lib/renown-person'

/**
 * What to call the person behind an address or did:pkh: their Renown profile name, else their
 * ENS name; null when neither is known (yet). `address` is the parsed address, if any.
 */
export function usePersonName(value: string | null | undefined): {
  name: string | null
  address: string | null
} {
  const address = addressOf(value)
  const { data } = useQuery({
    queryKey: ['renown-person', address],
    queryFn: () => fetchRenownPerson(address ?? ''),
    enabled: !!address,
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const ens = useEnsName(address)
  return { name: personName(data) ?? ens, address }
}
