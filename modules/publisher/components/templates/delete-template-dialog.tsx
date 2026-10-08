'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/modules/shared/components/ui/alert-dialog'
import { useDeleteTemplate } from '../../hooks/use-publisher-mutations'
import { templateName } from '../../lib/format'
import { runWithToast } from '../../lib/run'
import type { PublisherTemplate } from '../../types'

export function DeleteTemplateDialog({
  appId,
  template,
  onClose,
}: {
  appId: string
  template: PublisherTemplate | null
  onClose: () => void
}) {
  const del = useDeleteTemplate(appId)
  const confirm = async () => {
    if (!template) return
    const ok = await runWithToast(() => del.mutateAsync({ templateId: template.id }), 'Template deleted')
    if (ok) onClose()
  }
  return (
    <AlertDialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {template ? templateName(template) : 'template'}?</AlertDialogTitle>
          <AlertDialogDescription>
            No plan uses it, so nobody loses anything. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={del.isPending}
            onClick={(e) => {
              e.preventDefault()
              void confirm()
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete template
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
