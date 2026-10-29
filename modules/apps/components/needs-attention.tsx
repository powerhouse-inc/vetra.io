'use client'

import { AlertTriangle, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { attentionItems } from '@/modules/apps/lib/attention'
import { useEnvironments } from '@/modules/cloud/hooks/use-environment'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import { cn } from '@/modules/shared/lib/utils'
import { useMySubscriptions } from '@/modules/subscriptions/hooks/use-subscriptions'

/**
 * Console home strip listing what needs the owner: failed or degraded environments
 * and subscription warnings. Renders nothing when all is well.
 */
export function NeedsAttention() {
  const { orgId } = useActiveOrg()
  const { environments } = useEnvironments('MINE', null, { orgId })
  const { data: subscriptions } = useMySubscriptions()
  const items = attentionItems(environments, subscriptions ?? [])
  if (items.length === 0) return null

  return (
    <section
      aria-labelledby="needs-attention"
      className="border-warning/40 bg-card rounded-xl border"
    >
      <h2
        id="needs-attention"
        className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold"
      >
        <AlertTriangle className="text-warning h-4 w-4" aria-hidden />
        Needs attention
      </h2>
      <ul className="divide-border divide-y">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="hover:bg-secondary/40 flex items-center gap-3 px-4 py-3 text-sm transition-colors"
            >
              <span
                aria-hidden
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  item.tone === 'danger' ? 'bg-destructive' : 'bg-warning',
                )}
              />
              <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
              <span
                className={cn(
                  'shrink-0 text-xs',
                  item.tone === 'danger' ? 'text-destructive' : 'text-warning',
                )}
              >
                {item.detail}
              </span>
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
