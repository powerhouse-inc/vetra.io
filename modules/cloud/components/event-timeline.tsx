import type { KubeEvent } from '@/modules/cloud/types'
import { Badge } from '@/modules/shared/components/ui/badge'
import { timeAgo } from '@/modules/shared/lib/time'

type EventTimelineProps = {
  events: KubeEvent[]
  isLoading?: boolean
}

/**
 * Vertical event list — time, type, reason, message, involvedObject.
 *
 * Each row is a CSS grid so the timestamp / type / reason columns stay
 * column-aligned across rows while the message wraps freely. The message
 * field used to be `line-clamp-1`-truncated which made longer messages
 * useless; now the row simply gets taller when needed.
 */
export function EventTimeline({ events, isLoading }: EventTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-start gap-3">
            <div className="bg-muted h-4 w-12 rounded" />
            <div className="bg-muted h-4 w-16 rounded" />
            <div className="bg-muted h-4 w-24 rounded" />
            <div className="bg-muted h-4 flex-1 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">No recent events</p>
  }

  return (
    <ul className="divide-border/40 divide-y">
      {events.map((event, i) => (
        <li
          key={i}
          className="grid grid-cols-[3.5rem_5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 py-2 text-sm sm:grid-cols-[3.5rem_5rem_minmax(0,1fr)_minmax(0,12rem)]"
        >
          <span className="text-muted-foreground pt-0.5 text-xs">{timeAgo(event.timestamp)}</span>

          <span className="pt-0.5">
            {event.type === 'WARNING' ? (
              <Badge
                size="xs"
                variant="secondary"
                className="bg-warning/15 text-warning border-transparent"
              >
                WARNING
              </Badge>
            ) : (
              <Badge
                size="xs"
                variant="secondary"
                className="bg-muted text-muted-foreground border-transparent"
              >
                NORMAL
              </Badge>
            )}
          </span>

          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">{event.reason}</span>
            </div>
            <p className="text-foreground/90 text-sm break-words">{event.message}</p>
          </div>

          <span
            className="text-muted-foreground hidden truncate font-mono text-xs sm:block"
            title={event.involvedObject}
          >
            {event.involvedObject}
          </span>
        </li>
      ))}
    </ul>
  )
}
