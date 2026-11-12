'use client'

import { Loader2, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

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
import { PersonName } from '@/modules/shared/components/person-name'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { formatTimestamp, timeAgo } from '@/modules/shared/lib/time'

import { describeAppsError } from '../graphql'
import { useAppRoles, useRemoveAppRole, useSetAppRole } from '../hooks/use-apps'
import { parseRoleAddress } from '../lib/access'
import type { AppRole } from '../types'

export const RELEASE_MANAGERS_HINT =
  'Release managers change plans and environment settings (and, soon, rollouts). They cannot edit, deploy or delete the app, or name other release managers.'

function RemoveDialog({
  appId,
  role,
  onClose,
}: {
  appId: string
  role: AppRole | null
  onClose: () => void
}) {
  const remove = useRemoveAppRole(appId)
  const confirm = () => {
    if (!role) return
    remove.mutate(role.address, {
      onSuccess: () => {
        toast.success('Release manager removed')
        onClose()
      },
      onError: (err) => toast.error(describeAppsError(err)),
    })
  }
  return (
    <AlertDialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove {role ? <PersonName value={role.address} /> : null} as release manager?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They can no longer change this app&apos;s plans or environment settings. What they
            already changed stays.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={remove.isPending}
            className="bg-destructive hover:bg-destructive/90 text-white"
          >
            {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function AddReleaseManager({ appId, roles }: { appId: string; roles: AppRole[] }) {
  const set = useSetAppRole(appId)
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const address = parseRoleAddress(value)
  const already = !!address && roles.some((r) => r.address.toLowerCase() === address)
  const error = !touched
    ? null
    : !address
      ? 'Enter an address (0x and 40 hex digits) or a did:pkh.'
      : already
        ? 'Already a release manager.'
        : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!address || already) return
    set.mutate(address, {
      onSuccess: () => {
        toast.success('Release manager added')
        setValue('')
        setTouched(false)
      },
      onError: (err) => toast.error(describeAppsError(err)),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-1.5" noValidate>
      <Label htmlFor="release-manager-address">Add release manager</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="release-manager-address"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => value.trim() && setTouched(true)}
          placeholder="0x… or did:pkh:…"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          aria-invalid={!!error}
          aria-describedby={error ? 'release-manager-error' : undefined}
        />
        <Button type="submit" disabled={set.isPending} className="shrink-0">
          {set.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Add
        </Button>
      </div>
      {error && (
        <p id="release-manager-error" role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </form>
  )
}

/**
 * The App's release managers, with add and remove, for its owner and org admins (the Settings
 * tab's Access card). People show by Renown name; their address is in the tooltip.
 */
export function ReleaseManagers({ appId }: { appId: string }) {
  const roles = useAppRoles(appId)
  const [removing, setRemoving] = useState<AppRole | null>(null)
  const list = roles.data ?? []

  return (
    <div className="space-y-5">
      {roles.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : roles.error ? (
        <p role="alert" className="text-destructive text-sm">
          {describeAppsError(roles.error)}
        </p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground text-sm">No release managers yet.</p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {list.map((r) => (
            <li
              key={r.address}
              data-testid={`release-manager-${r.address}`}
              className="flex items-center gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <PersonName value={r.address} avatar className="text-sm font-medium" />
                <p className="text-muted-foreground text-xs" title={formatTimestamp(r.grantedAt)}>
                  named {timeAgo(r.grantedAt)} by <PersonName value={r.grantedBy} />
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRemoving(r)}>
                <X className="h-4 w-4" />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <AddReleaseManager appId={appId} roles={list} />
      <RemoveDialog appId={appId} role={removing} onClose={() => setRemoving(null)} />
    </div>
  )
}
