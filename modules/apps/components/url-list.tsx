import { ArrowUpRight, Boxes, LayoutDashboard, Network } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import { displayHost } from '../lib/status'
import type { AppUrls } from '../types'
import { CopyButton } from './copy-button'

const ROWS = [
  { key: 'app', label: 'App', icon: LayoutDashboard },
  { key: 'connect', label: 'Connect', icon: Boxes },
  { key: 'switchboard', label: 'Switchboard', icon: Network },
] as const

/** The env's public URLs (front-end, Connect, Switchboard), each openable + copyable. */
export function UrlList({ urls, className }: { urls: AppUrls; className?: string }) {
  const rows = ROWS.filter((r) => urls[r.key])
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No public URLs yet.</p>
  }
  return (
    <ul className={cn('border-border divide-border divide-y rounded-lg border', className)}>
      {rows.map((row) => {
        const url = urls[row.key] as string
        return (
          <li key={row.key} className="flex items-center gap-3 py-1 pr-1 pl-3">
            <row.icon className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            <span className="text-muted-foreground w-24 shrink-0 text-xs font-medium">
              {row.label}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary group inline-flex min-w-0 flex-1 items-center gap-1 truncate text-sm"
            >
              <span className="truncate">{displayHost(url)}</span>
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </a>
            <CopyButton value={url} label={`Copy ${row.label} URL`} />
          </li>
        )
      })}
    </ul>
  )
}
