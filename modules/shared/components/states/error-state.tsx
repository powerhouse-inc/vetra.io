import { AlertCircle, RefreshCw, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/modules/shared/components/ui/alert'
import { Button } from '@/modules/shared/components/ui/button'

export interface ErrorStateProps {
  title: string
  /** What failed and what to do next. */
  message: ReactNode
  /** Shows a Retry button when given. */
  onRetry?: () => void
  /** Spins the Retry icon and disables the button. */
  retrying?: boolean
  /** Server request id, shown small and selectable for support. */
  requestId?: string
  icon?: LucideIcon
  className?: string
}

/** Destructive alert for a failed load, with an optional Retry. */
export function ErrorState({
  title,
  message,
  onRetry,
  retrying = false,
  requestId,
  icon: Icon = AlertCircle,
  className,
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" className={className}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        {message}
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
            <RefreshCw className={retrying ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Retry
          </Button>
        )}
        {requestId && (
          <span className="text-muted-foreground w-full font-mono text-xs select-all">
            Request id: {requestId}
          </span>
        )}
      </AlertDescription>
    </Alert>
  )
}
