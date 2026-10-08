'use client'

import { RefreshCw } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'

/** Shown instead of the "nothing published yet" copy when the artifact list could not load. */
export function ArtifactsFailed({ what, onRetry }: { what: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Could not load your published {what}.</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  )
}
