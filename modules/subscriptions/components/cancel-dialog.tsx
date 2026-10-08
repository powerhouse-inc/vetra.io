'use client'

import { Loader2 } from 'lucide-react'
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
import { runWithToast } from '@/modules/publisher/lib/run'
import { useEffect, useState } from 'react'
import { useCancelSubscription } from '../hooks/use-subscriptions'
import { subscriptionName } from '../lib/subscriptions'
import type { Subscription } from '../types'

export function CancelDialog({ subscription: current, onClose }: { subscription: Subscription | null; onClose: () => void }) {
  const cancel = useCancelSubscription()
  // Keep the last subscription so the title and body do not flash while the dialog animates closed.
  const [last, setLast] = useState<Subscription | null>(current)
  useEffect(() => {
    if (current) setLast(current)
  }, [current])
  const subscription = current ?? last
  const confirm = async () => {
    if (!current) return
    const ok = await runWithToast(() => cancel.mutateAsync({ licenseId: current.licenseId }), 'Subscription cancelled')
    if (ok) onClose()
  }
  return (
    <AlertDialog open={!!current} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Cancel {subscription ? `${subscriptionName(subscription)} on ${subscription.appName}` : 'subscription'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {subscription?.mode === 'SHARED'
              ? `You lose access to ${subscription.appName} right away.`
              : 'Your environment keeps running for 14 days, then stops. Your data is kept for about three months before it is deleted — get a new licence before then and it comes back.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancel.isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={cancel.isPending}
            onClick={(e) => {
              e.preventDefault()
              void confirm()
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Cancel subscription
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
