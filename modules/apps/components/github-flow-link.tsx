'use client'

import type { AnchorHTMLAttributes } from 'react'

import { startGithubFlow } from '../lib/github-state'

/**
 * Link to a Vetra Deploy GitHub install/authorize URL. Clicking stores a fresh
 * `state` nonce and appends it, so the callback can prove the round-trip
 * started in this browser. Without a URL it renders inert.
 */
export function GithubFlowLink({
  url,
  onClick,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { url: string | null | undefined }) {
  return (
    <a
      {...props}
      href={url ?? undefined}
      aria-disabled={!url || undefined}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || !url) return
        e.preventDefault()
        startGithubFlow(url)
      }}
    />
  )
}
