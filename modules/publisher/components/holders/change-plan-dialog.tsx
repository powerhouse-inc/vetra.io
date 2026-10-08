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
import { useLastPresent } from '@/modules/shared/hooks/use-last-present'
import { useReplaceGrant } from '../../hooks/use-publisher-mutations'
import { shortDid, termName } from '../../lib/format'
import { changePlanTargets } from '../../lib/holders'
import { runWithToast } from '../../lib/run'
import type { PublisherLicense, PublisherTerm, TemplateMode } from '../../types'

/** Upgrade or downgrade in place: the new licence inherits the environment. */
export function ChangePlanDialog({
  appId,
  license,
  terms,
  plansUnavailable = false,
  modeOf = () => null,
  onClose,
}: {
  appId: string
  license: PublisherLicense | null
  terms: PublisherTerm[]
  plansUnavailable?: boolean
  /** Mode of the template behind a plan, or null when it is not known. */
  modeOf?: (kind: string) => TemplateMode | null
  onClose: () => void
}) {
  const replace = useReplaceGrant(appId)
  const [kind, setKind] = useState('')
  // Keep the last licence so the copy does not flip while the dialog fades out; the choice is
  // cleared when it opens again, not mid-fade.
  const shown = useLastPresent(license)
  const [wasOpen, setWasOpen] = useState(!!license)
  if (!!license !== wasOpen) {
    setWasOpen(!!license)
    if (license) setKind('')
  }
  const options = shown ? changePlanTargets(terms, shown) : []
  const target = options.find((t) => t.kind === kind)
  // The environment is only carried over between two dedicated plans.
  const keepsEnvironment =
    !!shown && !!target && modeOf(shown.kind) === 'DEDICATED' && modeOf(target.kind) === 'DEDICATED'
  const description = !shown
    ? ''
    : keepsEnvironment
      ? `${shortDid(shown.user)} keeps their environment. It is rebuilt from the new plan’s template.`
      : `Move ${shortDid(shown.user)} to another plan. Their access follows the new plan.`

  const close = onClose
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>New plan</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger aria-label="New plan" className="w-full">
              <SelectValue
                placeholder={
                  plansUnavailable
                    ? 'Your plans did not load'
                    : options.length
                      ? 'Choose a plan'
                      : 'No other plan allows grants'
                }
              />
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
