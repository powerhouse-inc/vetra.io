import { Loader2, Moon } from 'lucide-react'
import type { MockStatus } from './mock-data'

/**
 * IDEATION ONLY — status indicator shared by the Studio header and child cards.
 * Mirrors the `STATUS_LABELS`/`StatusDot` pattern in cloud-projects.tsx, with a
 * dedicated treatment for the new RUNNING and HIBERNATING states.
 */
const CONFIG: Record<MockStatus, { label: string; dot: string; text: string }> = {
  RUNNING: { label: 'Running', dot: 'bg-green-500', text: 'text-green-600' },
  READY: { label: 'Ready', dot: 'bg-green-500', text: 'text-green-600' },
  HIBERNATING: { label: 'Hibernating', dot: 'bg-sky-400', text: 'text-sky-600' },
  DEPLOYING: { label: 'Deploying', dot: 'bg-amber-400', text: 'text-amber-600' },
  STOPPED: { label: 'Stopped', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
}

export function StatusPill({ status }: { status: MockStatus }) {
  const c = CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.text}`}>
      {status === 'HIBERNATING' ? (
        <Moon className="h-3 w-3" aria-hidden />
      ) : status === 'DEPLOYING' ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
      )}
      {c.label}
    </span>
  )
}
