'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/modules/shared/components/ui/sheet'
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
  onClose,
}: {
  appId: string
  template: PublisherTemplate | null
  open: boolean
  onClose: () => void
}) {
  const { guard, dialog } = useAffectsConfirm(template?.environmentCount ?? 0)
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
        {!template ? (
          <div className="px-4">
            <TabSkeleton rows={2} label="Loading template" />
          </div>
        ) : (
          <div className="space-y-8 px-4 pb-10">
            <p className="bg-muted rounded-lg px-3 py-2 text-sm" data-testid="template-summary">
              {describeTemplate(template)}
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
