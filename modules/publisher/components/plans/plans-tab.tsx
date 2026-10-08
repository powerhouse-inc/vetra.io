'use client'

import { Plus, Tags } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import { usePublisherTemplates, usePublisherTerms } from '../../hooks/use-publisher'
import type { PublisherTerm } from '../../types'
import { EmptyState, TabError, TabHeader, TabSkeleton } from '../primitives'
import { PlanDialog } from './plan-dialog'
import { PlanRow } from './plan-row'
import { PlanStatusDialog, type PlanStatusAction } from './plan-status-dialog'

export function PlansTab({ appId }: { appId: string }) {
  const terms = usePublisherTerms(appId)
  const templates = usePublisherTemplates(appId)
  const [editing, setEditing] = useState<{ term: PublisherTerm | null } | null>(null)
  const [status, setStatus] = useState<PlanStatusAction | null>(null)
  const list = terms.data ?? []
  const templateList = templates.data ?? []
  const noTemplates = !templates.isPending && !templates.error && templateList.length === 0

  return (
    <div className="space-y-6">
      <TabHeader
        title="Plans"
        description="What you offer: a template, for how long, handed out by invite code or by you."
        action={
          list.length > 0 && (
            <Button onClick={() => setEditing({ term: null })}>
              <Plus className="h-4 w-4" />
              New plan
            </Button>
          )
        }
      />
      {terms.isPending ? (
        <TabSkeleton label="Loading plans" />
      ) : terms.error ? (
        <TabError error={terms.error} onRetry={() => void terms.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No plans yet"
          action={
            noTemplates ? (
              <Button asChild variant="outline">
                <Link href="?tab=templates">Create a template first</Link>
              </Button>
            ) : (
              <Button onClick={() => setEditing({ term: null })}>
                <Plus className="h-4 w-4" />
                Create your first plan
              </Button>
            )
          }
        >
          A plan is what people actually get, like “Free” or “Conference 2026”. It points at a
          template and says how long it lasts.
        </EmptyState>
      ) : (
        <>
          {templates.error && (
            <p
              role="alert"
              className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm"
            >
              Your templates did not load, so plans may show the wrong template.
              <Button size="sm" variant="outline" onClick={() => void templates.refetch()}>
                Try again
              </Button>
            </p>
          )}
          <ul className="bg-card border-border divide-border divide-y rounded-xl border shadow-sm">
            {list.map((t) => (
              <PlanRow
                key={t.id}
                term={t}
                template={templateList.find((x) => x.id === t.templateId)}
                templatesUnavailable={!!templates.error || templates.isPending}
                onEdit={() => setEditing({ term: t })}
                onPublish={() => setStatus({ action: 'publish', term: t })}
                onRetire={() => setStatus({ action: 'retire', term: t })}
              />
            ))}
          </ul>
        </>
      )}
      <PlanDialog
        key={editing?.term?.id ?? 'new'}
        appId={appId}
        term={editing?.term ?? null}
        templates={templateList}
        templatesUnavailable={!!templates.error}
        onRetryTemplates={() => void templates.refetch()}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
      <PlanStatusDialog appId={appId} pending={status} onClose={() => setStatus(null)} />
    </div>
  )
}
