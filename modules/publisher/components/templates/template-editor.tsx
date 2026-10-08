'use client'

import { Button } from '@/modules/shared/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/modules/shared/components/ui/sheet'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { describeTemplate, templateToForm } from '../../lib/template'
import { envCountText, templateName } from '../../lib/format'
import type { PublisherTemplate } from '../../types'
import { TabSkeleton } from '../primitives'
import { useAffectsConfirm } from './affects-confirm'
import { TemplateContents } from './template-contents'
import { TemplateDetailsForm } from './template-details-form'

/** Side sheet for one template. `template` is null right after create, until the list refetches. */
export function TemplateEditor({
  appId,
  template,
  open,
  missing = false,
  onClose,
}: {
  appId: string
  template: PublisherTemplate | null
  open: boolean
  /** The list has loaded and does not contain this template (deleted elsewhere). */
  missing?: boolean
  onClose: () => void
}) {
  const { guard, dialog } = useAffectsConfirm(template?.environmentCount ?? 0)
  const { viewer } = useViewer()
  const { environments } = useEnvironments('MINE', viewer?.address ?? null)
  const sharedEnv = environments.find((e) => e.id === template?.sharedEnvironment)
  const sharedEnvName = sharedEnv ? sharedEnv.state.label || sharedEnv.name || null : null
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{template ? templateName(template) : 'New template'}</SheetTitle>
          <SheetDescription>
            {template && template.environmentCount > 0
              ? `${envCountText(template.environmentCount)} run on this template. Saving re-applies to all of them.`
              : 'Changes apply to every environment built from this template.'}
          </SheetDescription>
        </SheetHeader>
        {!template && missing ? (
          <div className="space-y-3 px-4" role="alert">
            <p className="text-sm">This template is no longer here. It may have been deleted.</p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Back to templates
            </Button>
          </div>
        ) : !template ? (
          <div className="px-4">
            <TabSkeleton rows={2} label="Loading template" />
          </div>
        ) : (
          <div className="space-y-8 px-4 pb-10">
            <p className="bg-muted rounded-lg px-3 py-2 text-sm" data-testid="template-summary">
              {describeTemplate(template, sharedEnvName)}
            </p>
            {/* Remount on any server-side change so the form shows what was saved. */}
            <TemplateDetailsForm
              key={JSON.stringify(templateToForm(template))}
              appId={appId}
              template={template}
              guard={guard}
            />
            <TemplateContents appId={appId} template={template} guard={guard} />
          </div>
        )}
        {dialog}
      </SheetContent>
    </Sheet>
  )
}
