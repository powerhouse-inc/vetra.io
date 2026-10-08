'use client'

import { RefreshCw } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'

/** Shown instead of the "nothing published yet" copy when the artifact list could not load. */
export function ArtifactsFailed({
  what,
  onRetry,
  retrying = false,
}: {
  what: string
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Could not load your published {what}.</span>
      <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
        <RefreshCw className={retrying ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
        Try again
      </Button>
    </div>
  )
}
