'use client'

import { Pencil } from 'lucide-react'
import { StatusPill } from '@/modules/apps/components/status'
import { Button } from '@/modules/shared/components/ui/button'
import { templateName, termName, validityText } from '../../lib/format'
import { issuerLabel, publishBlocker } from '../../lib/plan'
import { termStatusMeta } from '../../lib/status'
import type { PublisherTemplate, PublisherTerm } from '../../types'

export function PlanRow({
  term,
  template,
  templatesUnavailable = false,
  onEdit,
  onPublish,
  onRetire,
}: {
  term: PublisherTerm
  template: PublisherTemplate | undefined
  templatesUnavailable?: boolean
  onEdit: () => void
  onPublish: () => void
  onRetire: () => void
}) {
  const blocker = term.status !== 'ACTIVE' ? publishBlocker(term) : null
  return (
    <li
      data-testid={`plan-${term.id}`}
      className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 font-semibold break-words">{termName(term)}</h3>
          <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
            {term.kind}
          </code>
          <StatusPill meta={termStatusMeta(term.status)} />
        </div>
        <dl className="text-muted-foreground grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs">Template</dt>
            <dd className="text-foreground">
              {template
                ? templateName(template)
                : term.templateId
                  ? templatesUnavailable
                    ? 'Could not load'
                    : 'Deleted template'
                  : 'Not chosen yet'}
            </dd>
          </div>
          <div>
            <dt className="text-xs">Valid for</dt>
            <dd className="text-foreground">{validityText(term.validityDays)}</dd>
          </div>
          <div>
            <dt className="text-xs">Given out by</dt>
            <dd className="text-foreground">
              {term.issuers.length ? term.issuers.map(issuerLabel).join(', ') : 'Nobody yet'}
            </dd>
          </div>
          <div>
            <dt className="text-xs">Holders</dt>
            <dd className="text-foreground">
              {term.activeLicenses === 1
                ? '1 active licence'
                : `${term.activeLicenses} active licences`}
            </dd>
          </div>
        </dl>
        {blocker && <p className="text-warning text-xs">{blocker}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        {term.status === 'ACTIVE' ? (
          <Button size="sm" variant="outline" onClick={onRetire}>
            Retire
          </Button>
        ) : (
          <Button size="sm" onClick={onPublish} disabled={!!blocker}>
            {term.status === 'RETIRED' ? 'Publish again' : 'Publish'}
          </Button>
        )}
      </div>
    </li>
  )
}
