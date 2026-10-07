'use client'

import { useDid } from '@powerhousedao/reactor-browser'

/**
 * The ONE source of the viewer DID for the publisher module (reads and mutations).
 * `did` is the raw value: undefined until the wallet resolves. Gate queries on it.
 * `keyDid` is the cache-key segment ('anon' while unresolved). Never gate on keyDid:
 * it is always truthy, and a shared 'anon' entry could leak one wallet's data to another.
 */
export function useViewerDid(): { did: string | undefined; keyDid: string } {
  const did = useDid() || undefined
  return { did, keyDid: did ?? 'anon' }
}
