import type { ClintAgentStatusTone } from '@/modules/cloud/lib/clint-agent-status'
import { StatusPill } from '@/modules/shared/components/status'
import type { StatusTone } from '@/modules/shared/lib/status'

const TONE: Record<ClintAgentStatusTone, StatusTone> = {
  healthy: 'success',
  starting: 'progress',
  restarting: 'progress',
  failed: 'danger',
  stopped: 'neutral',
}

type Props = {
  tone: ClintAgentStatusTone
  label: string
  /** Tooltip text — usually the human-readable reason for the tone. */
  reason?: string
  className?: string
}

/**
 * Small status pill with a colored leading dot. Used by AgentCard and the
 * agent detail drawer so live-status visualisation reads the same across
 * the Overview tab regardless of whether the row is a clint agent, a
 * Connect/Switchboard service, or anything else with a derived tone.
 */
export function LiveStatusPill({ tone, label, reason, className }: Props) {
  const mapped = TONE[tone]
  return (
    <StatusPill
      meta={{ label, tone: mapped, active: mapped === 'progress' }}
      title={reason}
      className={className}
    />
  )
}
