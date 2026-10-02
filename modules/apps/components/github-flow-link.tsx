'use client'

import type { AnchorHTMLAttributes } from 'react'

import { GITHUB_REAUTH_KEY, startGithubFlow } from '../lib/github-state'

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
        try {
          // A user-started flow gets a fresh automatic re-authorize allowance.
          window.sessionStorage.removeItem(GITHUB_REAUTH_KEY)
        } catch {
          /* storage blocked */
        }
        startGithubFlow(url)
      }}
    />
  )
}
