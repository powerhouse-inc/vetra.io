'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

/**
 * Drawer scope keyed in the URL as `?drawer=<kind>:<id>&drawerTab=<tab>`.
 *
 * Two kinds: `service` (CONNECT/SWITCHBOARD/FUSION, id = lowercased type) and
 * `agent` (CLINT, id = service prefix). Database backups live inside the
 * Switchboard service drawer's Database tab — there's no separate scope for
 * them. Anything that doesn't parse cleanly means "no drawer open".
 */
export type DrawerScope =
  { kind: 'service'; id: 'connect' | 'switchboard' | 'fusion' } | { kind: 'agent'; id: string }

const VALID_SERVICE_IDS = new Set(['connect', 'switchboard', 'fusion'])

function parseDrawer(value: string | null): DrawerScope | null {
  if (!value) return null
  const colon = value.indexOf(':')
  if (colon < 1) return null
  const kind = value.slice(0, colon)
  const id = value.slice(colon + 1)
  if (!id) return null
  if (kind === 'service' && VALID_SERVICE_IDS.has(id)) {
    return { kind: 'service', id: id as 'connect' | 'switchboard' | 'fusion' }
  }
  if (kind === 'agent') return { kind: 'agent', id }
  return null
}

function serializeDrawer(scope: DrawerScope): string {
  return `${scope.kind}:${scope.id}`
}

export type UseDetailDrawer = {
  scope: DrawerScope | null
  tab: string | null
  open: (scope: DrawerScope, tab?: string) => void
  setTab: (tab: string) => void
  close: () => void
}

export function useDetailDrawer(): UseDetailDrawer {
  const router = useRouter()
  const params = useSearchParams()

  const scope = useMemo(() => parseDrawer(params.get('drawer')), [params])
  const tab = params.get('drawerTab')

  const replaceParams = useCallback(
    (mut: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString())
      mut(next)
      const qs = next.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    },
    [params, router],
  )

  const open = useCallback(
    (next: DrawerScope, nextTab?: string) => {
      replaceParams((p) => {
        p.set('drawer', serializeDrawer(next))
        if (nextTab) p.set('drawerTab', nextTab)
        else p.delete('drawerTab')
      })
    },
    [replaceParams],
  )

  const setTab = useCallback(
    (nextTab: string) => {
      replaceParams((p) => p.set('drawerTab', nextTab))
    },
    [replaceParams],
  )

  const close = useCallback(() => {
    replaceParams((p) => {
      p.delete('drawer')
      p.delete('drawerTab')
    })
  }, [replaceParams])

  return { scope, tab, open, setTab, close }
}
