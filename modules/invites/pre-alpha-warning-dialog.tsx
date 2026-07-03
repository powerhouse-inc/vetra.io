'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'

/**
 * One-time heads-up shown immediately after a fresh invite-code redemption:
 * Vetra Studio is pre-alpha, so data isn't durable. Nudge the user to back up
 * their work (download documents / push to GitHub) at the end of a cycle.
 *
 * Controlled by the gate so it fires only on a genuine first redemption, not for
 * returning users with a cached grant.
 */
export function PreAlphaWarningDialog({
  open,
  onAcknowledge,
}: {
  open: boolean
  onAcknowledge: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onAcknowledge() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="bg-warning/15 mb-1 flex h-10 w-10 items-center justify-center rounded-full">
            <AlertTriangle className="text-warning h-5 w-5" />
          </div>
          <DialogTitle>Vetra Studio is in pre-alpha</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Any data you generate might be at risk of loss. At the end of a product development
            cycle, please feel free to download your created documents or push them to a GitHub
            repository as a back-up.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onAcknowledge}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
