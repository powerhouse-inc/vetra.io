'use client'

import { Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { describeCloudError } from '@/modules/cloud/lib/cloud-error'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/modules/shared/components/ui/alert-dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  displayName: string
  /** Deletes the environment. A rejection keeps the dialog open and toasts. */
  onConfirm: () => Promise<void>
  /** Optional trigger, rendered through `AlertDialogTrigger asChild`. */
  children?: ReactNode
}

/**
 * The one "Delete environment?" confirmation, shared by the environment card
 * and the settings drawer. The dialog stays open with a spinner while the
 * delete runs, closes on success, and stays open on failure so the error
 * toast shows against the confirm screen.
 */
export function DeleteEnvironmentDialog({
  open,
  onOpenChange,
  displayName,
  onConfirm,
  children,
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      toast.success('Environment deleted')
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to delete environment:', err)
      toast.error(describeCloudError(err, "Couldn't delete the environment. Try again."))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
      {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete environment?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes &ldquo;{displayName}&rdquo; and all of its data. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Don't auto-close: keep the dialog open while the delete runs.
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isDeleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
