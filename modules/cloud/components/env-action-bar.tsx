'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { PendingChange } from '@/modules/cloud/lib/pending-changes'
import { Button } from '@/modules/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/modules/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'

type Props = {
  /** Current env status from the doc model (e.g. DRAFT, CHANGES_PENDING, READY). */
  status: string | undefined
  /**
   * Local intent-lock signal from the page. Flipped synchronously on click
   * (Approve / Deploy). While true, the bar speculatively renders
   * "Deploying…" for a short window regardless of what raw `status` says —
   * this hides the subscription-resync flicker where status briefly reverts
   * to CHANGES_PENDING before the server settles on DEPLOYING.
   */
  intentDeploying: boolean
  /** Whether the cluster's config has drifted from the doc. */
  driftDetected: boolean
  /** What Approve would deploy; listed behind the "N pending changes" count. */
  pendingChanges?: readonly PendingChange[]
  onApprove: () => void
}

const DEPLOYING_STATUSES = new Set([
  'CHANGES_APPROVED',
  'CHANGES_PUSHED',
  'DEPLOYING',
  // historical typo in the doc model — kept here defensively so the bar
  // still recognises it as a deploying state.
  'DEPLOYMENt_FAILED',
])

const HIDDEN_STATUSES = new Set(['STOPPED', 'TERMINATING', 'DESTROYED', 'ARCHIVED'])

/** Time the speculative "Deploying…" view holds before raw status takes over. */
const INTENT_WINDOW_MS = 3000

/**
 * Floating action bar pinned to the bottom of the viewport. Appears only when
 * there's an action to take or a non-steady state worth surfacing; stays out
 * of the user's way when the env is just running.
 *
 * Uses an "intent lock" to mask the subscription-resync race: when the user
 * clicks Approve, the parent flips `intentDeploying` synchronously and the
 * bar renders the deploying body for ~3s, regardless of any flicker in raw
 * status. Once the window expires, raw status drives rendering normally —
 * by then the server has stabilised.
 */
export function EnvActionBar({
  status,
  intentDeploying,
  driftDetected,
  pendingChanges = [],
  onApprove,
}: Props) {
  // Track when the intent was raised so we can drop the lock after the
  // window, even if the page keeps `intentDeploying` true longer than needed.
  const [intentSince, setIntentSince] = useState<number | null>(null)
  useEffect(() => {
    if (intentDeploying) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIntentSince((prev) => prev ?? Date.now())
    } else {
      setIntentSince(null)
    }
  }, [intentDeploying])

  // Re-render once the intent window expires so the bar can fall back to raw
  // status. Without this we'd render stale until some other prop changes.
  const [, force] = useState(0)
  useEffect(() => {
    if (intentSince === null) return
    const remaining = INTENT_WINDOW_MS - (Date.now() - intentSince)
    if (remaining <= 0) return
    const t = setTimeout(() => force((n) => n + 1), remaining)
    return () => clearTimeout(t)
  }, [intentSince])

  // eslint-disable-next-line react-hooks/purity
  const intentActive = intentSince !== null && Date.now() - intentSince < INTENT_WINDOW_MS

  const body = renderBody({ status, intentActive, driftDetected, pendingChanges, onApprove })

  return (
    <AnimatePresence>
      {body && (
        <motion.div
          key="env-action-bar"
          role="status"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={cn(
            'fixed inset-x-0 top-20 z-50 flex justify-center px-4',
            'pointer-events-none', // outer doesn't catch clicks; inner pill does
          )}
        >
          <div
            className={cn(
              'pointer-events-auto inline-flex items-center gap-3 rounded-full px-4 py-1.5',
              'border-border bg-background/95 supports-[backdrop-filter]:bg-background/80',
              'border shadow-lg backdrop-blur',
            )}
          >
            {body}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function renderBody({
  status,
  intentActive,
  driftDetected,
  pendingChanges,
  onApprove,
}: {
  status: string | undefined
  intentActive: boolean
  driftDetected: boolean
  pendingChanges: readonly PendingChange[]
  onApprove: () => void
}): React.ReactNode {
  // Intent always wins while the window is open. The user just clicked; show
  // them "Deploying…" until either the window closes or raw status catches up
  // — even if a stale subscription push briefly reverts status meanwhile.
  if (intentActive) return <DeployingBody />

  if (!status) return null
  if (HIDDEN_STATUSES.has(status)) return null

  if (status === 'DRAFT') {
    return (
      <>
        <span className="text-foreground text-sm">Ready to deploy</span>
        <Button
          size="sm"
          variant="default"
          onClick={onApprove}
          className="rounded-full px-5"
          aria-label="Deploy environment"
        >
          Deploy
        </Button>
      </>
    )
  }
  if (status === 'CHANGES_PENDING') {
    return (
      <>
        <PendingSummary changes={pendingChanges} />
        <Button
          size="sm"
          variant="default"
          onClick={onApprove}
          className="rounded-full px-5"
          aria-label="Approve pending changes"
        >
          Approve
        </Button>
      </>
    )
  }
  if (DEPLOYING_STATUSES.has(status)) return <DeployingBody />
  if (status === 'READY' && driftDetected) {
    return (
      <>
        <AlertTriangle className="text-warning h-3.5 w-3.5" />
        <span className="text-foreground text-sm">Running configuration is out of date</span>
      </>
    )
  }
  return null
}

const KIND_SIGN: Record<PendingChange['kind'], string> = { add: '+', remove: '−', change: '~' }
const KIND_CLASS: Record<PendingChange['kind'], string> = {
  add: 'text-success',
  remove: 'text-destructive',
  change: 'text-warning',
}

/** "N pending changes", opening the list of what Approve deploys. */
function PendingSummary({ changes }: { changes: readonly PendingChange[] }) {
  // Without the operation history (still loading) keep the plain wording.
  if (changes.length === 0) return <span className="text-foreground text-sm">Pending change</span>
  const count = changes.length === 1 ? '1 pending change' : `${changes.length} pending changes`
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-foreground text-sm underline decoration-dotted underline-offset-4 hover:decoration-solid"
        >
          {count}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-80 p-0">
        <p className="text-muted-foreground border-b px-3 py-2 text-xs">
          Approve deploys these changes
        </p>
        <ul className="max-h-64 overflow-y-auto py-1">
          {changes.map((change) => (
            <li key={change.key} className="flex items-start gap-2 px-3 py-1.5 text-sm">
              <span
                aria-hidden
                className={cn('w-3 shrink-0 text-center font-mono', KIND_CLASS[change.kind])}
              >
                {KIND_SIGN[change.kind]}
              </span>
              <span className="min-w-0 break-words">{change.label}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function DeployingBody() {
  return (
    <>
      <Loader2 className="text-success h-3.5 w-3.5 animate-spin" />
      <span className="text-foreground text-sm">Deploying…</span>
    </>
  )
}
