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
import { useCancelSubscription } from '../hooks/use-subscriptions'
import { subscriptionName } from '../lib/subscriptions'
import type { Subscription } from '../types'

export function CancelDialog({ subscription, onClose }: { subscription: Subscription | null; onClose: () => void }) {
  const cancel = useCancelSubscription()
  const confirm = async () => {
    if (!subscription) return
    const ok = await runWithToast(() => cancel.mutateAsync({ licenseId: subscription.licenseId }), 'Subscription cancelled')
    if (ok) onClose()
  }
  return (
    <AlertDialog open={!!subscription} onOpenChange={(o) => !o && onClose()}>
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
