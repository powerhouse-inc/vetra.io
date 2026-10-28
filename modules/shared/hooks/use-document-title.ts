'use client'

import { useEffect } from 'react'

/**
 * Tab title for client pages, in the root layout's `%s · Vetra` format (client pages
 * can't export metadata, and some titles are data: an app or environment name).
 * Restores the previous title on unmount. `null`/empty leaves the title alone.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = `${title} · Vetra`
    return () => {
      document.title = previous
    }
  }, [title])
}
