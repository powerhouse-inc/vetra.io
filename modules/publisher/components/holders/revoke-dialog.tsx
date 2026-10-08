'use client'

import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { Input } from '@/modules/shared/components/ui/input'
import { useLastPresent } from '@/modules/shared/hooks/use-last-present'
import { useRevokeLicense } from '../../hooks/use-publisher-mutations'
import { shortDid } from '../../lib/format'
import { runWithToast } from '../../lib/run'
import type { PublisherLicense, TemplateMode } from '../../types'

export function RevokeDialog({
  appId,
  license,
  mode,
  onClose,
}: {
  appId: string
  license: PublisherLicense | null
  mode: TemplateMode | null
  onClose: () => void
}) {
  const revoke = useRevokeLicense(appId)
  const [reason, setReason] = useState('')
  // Keep the last licence and mode so the copy does not flip while the dialog fades out.
  const current = useMemo(() => (license ? { license, mode } : null), [license, mode])
  const shown = useLastPresent(current)
  // A fresh reason each time it opens, cleared on open rather than mid-fade.
  const [wasOpen, setWasOpen] = useState(!!license)
  if (!!license !== wasOpen) {
    setWasOpen(!!license)
    if (license) setReason('')
  }
  const close = onClose
  const confirm = async () => {
    if (!license) return
    const ok = await runWithToast(
      () => revoke.mutateAsync({ licenseId: license.id, reason: reason.trim() || null }),
      'Licence revoked',
    )
    if (ok) close()
  }
  return (
    <AlertDialog open={!!license} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Revoke {shown ? shortDid(shown.license.user) : ''}’s licence?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {shown?.mode === 'SHARED'
              ? 'They lose access to your app right away.'
              : shown?.mode === 'DEDICATED'
                ? 'Their environment stops in 14 days and is deleted about three months later, unless they get a new licence first.'
                : 'They lose their licence. If it came with its own environment, that stops in 14 days and is deleted about three months later, unless they get a new licence first.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="revoke-reason" className="text-sm font-medium">
            Reason (optional)
          </label>
          <Input id="revoke-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={revoke.isPending}
            onClick={(e) => {
              e.preventDefault()
              void confirm()
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {revoke.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Revoke licence
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
