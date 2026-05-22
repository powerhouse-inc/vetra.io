'use client'

import { useEffect, useState } from 'react'

const cache = new Map<string, string | null>()

interface EnsIdeasResponse {
  name?: string | null
}

/**
 * Resolves an Ethereum address to its ENS name via the public ensideas REST
 * gateway. Falls back to `null` on any error so callers can render the raw
 * address. Results are cached for the lifetime of the page.
 */
async function resolveEns(address: string): Promise<string | null> {
  const lower = address.toLowerCase()
  if (cache.has(lower)) return cache.get(lower) ?? null

  try {
    const res = await fetch(`https://api.ensideas.com/ens/resolve/${encodeURIComponent(address)}`)
    if (!res.ok) {
      cache.set(lower, null)
      return null
    }
    const data = (await res.json()) as EnsIdeasResponse
    const name = data.name ?? null
    cache.set(lower, name)
    return name
  } catch {
    cache.set(lower, null)
    return null
  }
}

/**
 * React hook to resolve an ENS name for a given Ethereum address. Returns
 * `null` while resolving or when no ENS name is set on the address.
 *
 * `address` is treated as the state key — switching addresses resets the
 * cached name. This pattern avoids a synchronous `setName(null)` inside the
 * effect (which lints as a cascade-render hazard).
 */
export function useEnsName(address: string | null | undefined): string | null {
  // Seed from the in-memory cache so we don't flash the unresolved address
  // on every render when the lookup has already happened.
  const cached = address ? (cache.get(address.toLowerCase()) ?? null) : null
  const [name, setName] = useState<string | null>(cached)

  useEffect(() => {
    if (!address) return
    let cancelled = false
    void resolveEns(address).then((value) => {
      if (!cancelled) setName(value)
    })
    return () => {
      cancelled = true
    }
  }, [address])

  return address ? name : null
}

/**
 * Format an address for display. Shows "name.eth (0xab…cd)" when an ENS name
 * is known and just "0xab…cd" otherwise.
 */
export function formatAddress(address: string, ensName: string | null): string {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`
  return ensName ? `${ensName} (${short})` : short
}
