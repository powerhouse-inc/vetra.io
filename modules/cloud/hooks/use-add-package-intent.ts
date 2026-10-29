'use client'

import { useSyncExternalStore } from 'react'

const subscribe = (onChange: () => void) => {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

/**
 * The package picked in the public directory (`/user/environments?addPackage=`),
 * waiting for the visitor to choose an environment. Read from the URL directly so
 * the list page needs no Suspense boundary; null during server render.
 */
export function useAddPackageIntent(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get('addPackage'),
    () => null,
  )
}

/** Environment page link that opens "Add package" pre-filled when a package was picked. */
export function environmentHref(environmentId: string, addPackage: string | null): string {
  const base = `/user/environments/${environmentId}`
  return addPackage ? `${base}?addPackage=${encodeURIComponent(addPackage)}` : base
}
