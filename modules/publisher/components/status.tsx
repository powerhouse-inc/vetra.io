import { cn } from '@/shared/lib/utils'

import { TONE_BADGE, type StatusMeta } from '../lib/status'

export function StatusPill({ meta }: { meta: StatusMeta }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_BADGE[meta.tone],
      )}
    >
      {meta.label}
    </span>
  )
}
