'use client'

import { LayoutTemplate, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import { usePublisherTemplates, usePublisherTerms } from '../../hooks/use-publisher'
import type { PublisherTemplate } from '../../types'
import { EmptyState, TabError, TabHeader, TabSkeleton } from '../primitives'
import { CreateTemplateDialog } from './create-template-dialog'
import { DeleteTemplateDialog } from './delete-template-dialog'
import { TemplateCard } from './template-card'
import { TemplateEditor } from './template-editor'

export function TemplatesTab({ appId }: { appId: string }) {
  const templates = usePublisherTemplates(appId)
  const terms = usePublisherTerms(appId)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<PublisherTemplate | null>(null)

  const list = templates.data ?? []
  const editing = editingId ? (list.find((t) => t.id === editingId) ?? null) : null
  const usedBy = (id: string) => (terms.data ?? []).filter((t) => t.templateId === id)

  return (
    <div className="space-y-6">
      <TabHeader
        title="Templates"
        description="What an owner gets with a licence: an account on a shared environment, or an environment of their own."
        action={
          list.length > 0 && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New template
            </Button>
          )
        }
      />
      {templates.isPending ? (
        <TabSkeleton label="Loading templates" />
      ) : templates.error ? (
        <TabError error={templates.error} onRetry={() => void templates.refetch()} retrying={templates.isRefetching} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates yet"
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Create your first template
            </Button>
          }
        >
          Start here. A template describes what people get; a plan then decides who gets it and for
          how long.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              usedBy={usedBy(t.id)}
              onEdit={() => setEditingId(t.id)}
              onDelete={() => setDeleting(t)}
            />
          ))}
        </div>
      )}
      <CreateTemplateDialog
        appId={appId}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => setEditingId(id)}
      />
      <TemplateEditor appId={appId} template={editing} open={editingId !== null} onClose={() => setEditingId(null)} />
      <DeleteTemplateDialog appId={appId} template={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}
