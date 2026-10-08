'use client'

import { Pencil, Server, Trash2, Users } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'
import { envCountText, templateName, termName } from '../../lib/format'
import { describeTemplate } from '../../lib/template'
import type { PublisherTemplate, PublisherTerm } from '../../types'

export function TemplateCard({
  template,
  usedBy,
  usage = 'ready',
  onEdit,
  onDelete,
}: {
  template: PublisherTemplate
  usedBy: PublisherTerm[]
  /** Whether plan usage is known yet; until it is, nothing claims the template is free. */
  usage?: 'loading' | 'error' | 'ready'
  onEdit: () => void
  onDelete: () => void
}) {
  const name = templateName(template)
  const inUse = usedBy.length > 0
  const running = template.environmentCount > 0
  const blocker = inUse
    ? 'Move its plans to another template first'
    : usage === 'loading'
      ? 'Checking which plans use it'
      : usage === 'error'
        ? 'Could not check which plans use it'
        : running
          ? 'Environments still run on it'
          : undefined
  const Icon = template.mode === 'SHARED' ? Users : Server
  return (
    <article
      data-testid={`template-${template.id}`}
      className="bg-card border-border flex flex-col gap-4 rounded-xl border p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{name}</h3>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              {template.mode === 'SHARED' ? 'Shared' : 'Dedicated'}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">{describeTemplate(template)}</p>
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          {inUse
            ? `Used by ${usedBy.map(termName).join(', ')}`
            : usage === 'loading'
              ? 'Checking plans…'
              : usage === 'error'
                ? 'Could not check plans'
                : 'Not used by a plan yet'}
        </span>
        {template.mode === 'DEDICATED' && <span>{envCountText(template.environmentCount)}</span>}
      </div>
      <div className="border-border mt-auto flex gap-2 border-t pt-3">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={blocker !== undefined}
          title={blocker}
          aria-label={`Delete ${name}`}
          className="text-muted-foreground hover:text-destructive ml-auto"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  )
}
