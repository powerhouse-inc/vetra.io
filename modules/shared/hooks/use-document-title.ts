'use client'

import { useEffect } from 'react'

/**
 * Tab title for client pages, in the root layout's `%s · Vetra` format (client pages
 * can't export metadata, and some titles are data: an app or environment name).
 * Restores the previous title on unmount. `null`/empty leaves the title alone.
 *
 * The App Router writes the layout's metadata title ("Vetra") again on every
 * navigation, including `router.replace` of the search params (tabs, drawers), and
 * that can land after this effect. While mounted the hook therefore watches <head>
 * and puts its title back.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    const wanted = `${title} · Vetra`
    const previous = document.title
    const apply = () => {
      if (document.title !== wanted) document.title = wanted
    }
    apply()
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(apply)
    observer?.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => {
      observer?.disconnect()
      document.title = previous
    }
  }, [title])
}
