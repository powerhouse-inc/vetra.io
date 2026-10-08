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
import { usePublishTerm, useRetireTerm } from '../../hooks/use-publisher-mutations'
import { termName } from '../../lib/format'
import { runWithToast } from '../../lib/run'
import type { PublisherTerm } from '../../types'

export type PlanStatusAction = { action: 'publish' | 'retire'; term: PublisherTerm }

export function PlanStatusDialog({
  appId,
  pending,
  onClose,
}: {
  appId: string
  pending: PlanStatusAction | null
  onClose: () => void
}) {
  const publish = usePublishTerm(appId)
  const retire = useRetireTerm(appId)
  const busy = publish.isPending || retire.isPending
  const name = pending ? termName(pending.term) : ''
  const isRetire = pending?.action === 'retire'

  const confirm = async () => {
    if (!pending) return
    const ok = isRetire
      ? await runWithToast(() => retire.mutateAsync({ termId: pending.term.id }), `${name} retired`)
      : await runWithToast(
          () => publish.mutateAsync({ termId: pending.term.id }),
          `${name} is live`,
        )
    if (ok) onClose()
  }

  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isRetire ? `Retire ${name}?` : `Publish ${name}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {isRetire
              ? 'Nobody new can get this plan. Existing licences run until they end.'
              : pending?.term.status === 'RETIRED'
                ? 'People can get this plan again, through the ways you chose.'
                : 'People can get this plan through the ways you chose. Its kind is fixed from now on.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              void confirm()
            }}
          >
            {isRetire ? 'Retire plan' : 'Publish plan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
