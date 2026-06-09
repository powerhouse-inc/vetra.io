'use client'

import { ExternalLink } from 'lucide-react'

export function StudioFrame({ embedUrl }: { embedUrl: string }) {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-end border-b border-gray-800 bg-gray-950 px-3 py-1.5">
        <a
          href={embedUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ExternalLink className="h-3 w-3" /> Open in new tab
        </a>
      </div>
      <iframe
        src={embedUrl}
        title="Vetra Studio"
        className="min-h-0 flex-1 border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}
