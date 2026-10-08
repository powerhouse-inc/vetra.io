import { BadgeCheck, Ticket } from 'lucide-react'
import Link from 'next/link'

import type { PublisherApp } from '@/modules/publisher/types'
import { licensingOnlyHref } from '../lib/licensing-only'
import { AppAvatar } from './app-avatar'

/**
 * Card for an app that exists only for licensing (no repository, no deployments). Same frame as
 * AppCard; it opens straight on the app's plans.
 */
export function LicensingOnlyAppCard({ app }: { app: PublisherApp }) {
  return (
    <article
      data-testid={`licensing-only-app-${app.id}`}
      className="group bg-card border-border hover:border-primary/40 relative flex flex-col rounded-xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <AppAvatar name={app.name} seed={app.id} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate leading-tight font-semibold">
            <Link
              href={licensingOnlyHref(app.id)}
              className="focus-visible:ring-ring rounded-sm after:absolute after:inset-0 after:rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              {app.name}
            </Link>
          </h3>
          <p className="text-muted-foreground mt-1 truncate text-sm">No repository to deploy</p>
        </div>
        <span className="bg-muted text-muted-foreground inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
          <BadgeCheck className="h-3 w-3" aria-hidden />
          Licensing only
        </span>
      </div>

      <div className="mt-4 min-h-5">
        <span className="text-foreground/80 inline-flex items-center gap-1.5 text-sm">
          <Ticket className="h-3.5 w-3.5" aria-hidden />
          Plans, holders and invite codes
        </span>
      </div>

      <div className="text-muted-foreground border-border mt-4 border-t pt-3 text-xs">
        You decide here who gets it.
      </div>
    </article>
  )
}
