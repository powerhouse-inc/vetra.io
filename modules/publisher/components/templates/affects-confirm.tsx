'use client'

import { useCallback, useState, type ReactNode } from 'react'
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

export function affectsCopy(n: number): string {
  return n === 1
    ? 'This change re-applies to 1 running environment.'
    : `This change re-applies to ${n} running environments.`
}

type Pending = { title: string; run: () => Promise<unknown> }

/**
 * Every template write re-applies to all environments built from it, with no
 * staged rollout yet. When there are any, ask before sending.
 */
export function useAffectsConfirm(environmentCount: number): {
  guard: (title: string, run: () => Promise<unknown>) => void
  dialog: ReactNode
} {
  const [pending, setPending] = useState<Pending | null>(null)

  const guard = useCallback(
    (title: string, run: () => Promise<unknown>) => {
      if (environmentCount === 0) void run()
      else setPending({ title, run })
    },
    [environmentCount],
  )

  const confirm = () => {
    const p = pending
    setPending(null)
    if (p) void p.run()
  }

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {affectsCopy(environmentCount)} Every owner on this template gets it on the next
            provisioning pass, all at once.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction onClick={confirm}>
            Apply to {environmentCount === 1 ? '1 environment' : `${environmentCount} environments`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { guard, dialog }
}
