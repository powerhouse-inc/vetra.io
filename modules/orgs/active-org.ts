import type { MyOrg } from './types'

export const ACTIVE_ORG_KEY = 'vetra.activeOrg'
const listeners = new Set<() => void>()

export function readActiveOrg(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACTIVE_ORG_KEY) || null
  } catch {
    return null
  }
}

export function writeActiveOrg(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(ACTIVE_ORG_KEY, id)
    else window.localStorage.removeItem(ACTIVE_ORG_KEY)
  } catch {
    // Private mode / blocked storage: the context simply is not remembered.
  }
  for (const cb of listeners) cb()
}

export function subscribeActiveOrg(cb: () => void): () => void {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === ACTIVE_ORG_KEY) cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

/** The stored org only while it is (or may still be) one of the viewer's. */
export function resolveActiveOrgId(
  stored: string | null,
  orgs: MyOrg[] | undefined,
  failed: boolean,
): string | null {
  if (!stored) return null
  if (orgs) return orgs.some((o) => o.id === stored) ? stored : null
  return failed ? null : stored
}
