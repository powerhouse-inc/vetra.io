'use client'

import { useCallback, useEffect, useState } from 'react'

const MAX_ENTRIES = 20

function storageKey(tenantId: string | null): string | null {
  if (!tenantId) return null
  return `db-query-history:${tenantId}`
}

function readHistory(tenantId: string | null): string[] {
  const key = storageKey(tenantId)
  if (!key || typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

function writeHistory(tenantId: string | null, entries: string[]): void {
  const key = storageKey(tenantId)
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(entries))
  } catch {
    // localStorage may be unavailable (private mode / quota); silently skip.
  }
}

/**
 * Per-tenant recent-queries list backed by `localStorage` at the key
 * `db-query-history:${tenantId}`. Capped at 20 entries. Duplicates are
 * deduped by string equality (after trim) and moved to the front rather
 * than appended.
 */
export function useQueryHistory(tenantId: string | null): {
  history: string[]
  push: (sql: string) => void
  clear: () => void
} {
  const [history, setHistory] = useState<string[]>(() => readHistory(tenantId))

  // Re-read when the tenant changes so each env shows its own list.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(readHistory(tenantId))
  }, [tenantId])

  const push = useCallback(
    (sql: string) => {
      const trimmed = sql.trim()
      if (!trimmed) return
      setHistory((prev) => {
        const filtered = prev.filter((entry) => entry.trim() !== trimmed)
        const next = [trimmed, ...filtered].slice(0, MAX_ENTRIES)
        writeHistory(tenantId, next)
        return next
      })
    },
    [tenantId],
  )

  const clear = useCallback(() => {
    setHistory([])
    writeHistory(tenantId, [])
  }, [tenantId])

  return { history, push, clear }
}
