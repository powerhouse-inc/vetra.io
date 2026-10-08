'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import { Label } from '@/modules/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'
import { useReplaceGrant } from '../../hooks/use-publisher-mutations'
import { shortDid, termName } from '../../lib/format'
import { grantablePlans } from '../../lib/holders'
import { runWithToast } from '../../lib/run'
import type { PublisherLicense, PublisherTerm } from '../../types'

/** Upgrade or downgrade in place: the new licence inherits the environment. */
export function ChangePlanDialog({
  appId,
  license,
  terms,
  plansUnavailable = false,
  onClose,
}: {
  appId: string
  license: PublisherLicense | null
  terms: PublisherTerm[]
  plansUnavailable?: boolean
  onClose: () => void
}) {
  const replace = useReplaceGrant(appId)
  const [kind, setKind] = useState('')
  const options = grantablePlans(terms).filter((t) => t.kind !== license?.kind)
  const target = options.find((t) => t.kind === kind)

  const close = () => {
    setKind('')
    onClose()
  }
  const submit = async () => {
    if (!license || !target) return
    const ok = await runWithToast(
      () => replace.mutateAsync({ licenseId: license.id, kind: target.kind }),
      `Moved to ${termName(target)}`,
    )
    if (ok) close()
  }

  return (
    <Dialog open={!!license} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>
            {license ? `${shortDid(license.user)} keeps their environment. It is rebuilt from the new plan’s template.` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>New plan</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger aria-label="New plan" className="w-full">
              <SelectValue placeholder={plansUnavailable ? 'Your plans did not load' : options.length ? 'Choose a plan' : 'No other plan allows grants'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((t) => (
                <SelectItem key={t.id} value={t.kind}>
                  {termName(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!target || replace.isPending}>
            {replace.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {target ? `Move to ${termName(target)}` : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
