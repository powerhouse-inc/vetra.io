'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { resolveAuthToken } from '@/modules/cloud/client'
import {
  describeEnvironmentOrgError,
  handOverTargets,
  handOverToOrg,
} from '@/modules/cloud/org-sync'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/modules/shared/components/ui/alert-dialog'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'
import { AsyncButton } from '@/modules/cloud/components/async-button'

/**
 * "Move to an organisation" for a personal environment. Only the personal
 * owner sees it; the hand-over goes through the setEnvironmentOrg mutation
 * (Vetra signs the change) and is one-way.
 */
export function EnvOrgHandOver({
  environmentId,
  displayName,
  owner,
  ownerOrgId,
  status,
  appLinked,
  viewerAddress,
  onHandedOver,
}: {
  environmentId: string
  displayName: string
  owner: string | null | undefined
  ownerOrgId: string | null | undefined
  status: string | null | undefined
  appLinked: boolean
  viewerAddress: string | null | undefined
  /** After a successful move: refresh the loaded document so the org gate applies at once. */
  onHandedOver?: () => void
}) {
  const { orgs, orgId: activeOrgId } = useActiveOrg()
  const targets = handOverTargets({
    ownerOrgId,
    owner,
    viewer: viewerAddress,
    status,
    appLinked,
    orgs,
  })
  const [chosen, setChosen] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  if (targets.length === 0) return null
  const fallback = targets.find((o) => o.id === activeOrgId) ?? targets[0]
  const target = targets.find((o) => o.id === chosen) ?? fallback

  const handOver = async () => {
    try {
      await handOverToOrg(environmentId, target.id, await resolveAuthToken(), { attempts: 1 })
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      toast.error(describeEnvironmentOrgError(raw, target.name))
      return
    }
    setOpen(false)
    toast.success(`${displayName} now belongs to ${target.name}`)
    void qc.invalidateQueries({ queryKey: ['environment-org', environmentId] })
    void qc.invalidateQueries({ queryKey: ['environments'] })
    onHandedOver?.()
  }

  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <Building2 className="h-3.5 w-3.5" aria-hidden />
        Move to an organisation
      </div>
      <p className="text-muted-foreground text-xs">
        The organisation becomes the owner. Its publishers can then operate this environment and its
        members can view it.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {targets.length > 1 && (
          <Select value={target.id} onValueChange={setChosen}>
            <SelectTrigger className="h-8 w-56" aria-label="Organisation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targets.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              Move to {target.name}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Move &ldquo;{displayName}&rdquo; to {target.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This is one-way: the environment cannot be moved back to your personal account or to
                another organisation. From then on, access follows {target.name}&rsquo;s roles, so
                you keep operating it only while you are a publisher or above there.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AsyncButton
                size="sm"
                pendingLabel="Moving…"
                onClickAsync={async (e) => {
                  e.preventDefault()
                  await handOver()
                }}
              >
                Move to {target.name}
              </AsyncButton>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
