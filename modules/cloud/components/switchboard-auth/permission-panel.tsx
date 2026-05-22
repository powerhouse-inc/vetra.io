'use client'

import { useState } from 'react'

import { AsyncButton } from '@/modules/cloud/components/async-button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/modules/shared/components/ui/alert-dialog'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'

import { EnsAddress } from './ens-address'

export type PermissionLevel = 'READ' | 'WRITE' | 'ADMIN'

interface UserPermission {
  userAddress: string
  permission: PermissionLevel
}

interface GroupPermission {
  groupId: number
  group: { id: number; name: string }
  permission: PermissionLevel
}

export interface DocumentAccess {
  documentId: string
  permissions: UserPermission[]
  groupPermissions: GroupPermission[]
}

export interface AvailableGroup {
  id: number
  name: string
}

export interface DocumentProtection {
  protected: boolean
  ownerAddress: string | null
}

interface Props {
  access: DocumentAccess
  availableGroups: AvailableGroup[]
  nodeLabel: string
  onGrantUser: (address: string, level: PermissionLevel) => Promise<void> | void
  onRevokeUser: (address: string) => Promise<void> | void
  onGrantGroup: (groupId: number, level: PermissionLevel) => Promise<void> | void
  onRevokeGroup: (groupId: number) => Promise<void> | void
  onRefreshGroups: () => void
  protection?: DocumentProtection | null
  onSetProtection?: (next: boolean) => Promise<void> | void
  onTransferOwnership?: (newOwnerAddress: string) => Promise<void> | void
}

/**
 * Display a permission level as a coloured Badge. Palette mirrors the
 * auth-editor demo: READ = info-blue, WRITE = warning-amber, ADMIN = danger.
 */
function PermissionBadge({ level }: { level: PermissionLevel }) {
  if (level === 'READ') {
    return (
      <Badge variant="secondary" className="bg-info/15 text-info border-transparent">
        READ
      </Badge>
    )
  }
  if (level === 'WRITE') {
    return <Badge className="bg-warning/15 text-warning border-transparent">WRITE</Badge>
  }
  return <Badge className="bg-destructive/15 text-destructive border-transparent">ADMIN</Badge>
}

export function PermissionPanel({
  access,
  availableGroups,
  nodeLabel,
  onGrantUser,
  onRevokeUser,
  onGrantGroup,
  onRevokeGroup,
  onRefreshGroups,
  protection,
  onSetProtection,
  onTransferOwnership,
}: Props) {
  const [showGrantUser, setShowGrantUser] = useState(false)
  const [grantAddress, setGrantAddress] = useState('')
  const [grantLevel, setGrantLevel] = useState<PermissionLevel>('READ')
  const [showGrantGroup, setShowGrantGroup] = useState(false)
  const [grantGroupId, setGrantGroupId] = useState<number | null>(null)
  const [grantGroupLevel, setGrantGroupLevel] = useState<PermissionLevel>('READ')
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferAddress, setTransferAddress] = useState('')
  const [revokeUserDialog, setRevokeUserDialog] = useState<string | null>(null)
  const [revokeGroupDialog, setRevokeGroupDialog] = useState<{
    id: number
    name: string
  } | null>(null)
  const [protectionDialog, setProtectionDialog] = useState<'protect' | 'unprotect' | null>(null)

  const handleGrantUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!grantAddress.trim()) return
    void Promise.resolve(onGrantUser(grantAddress.trim(), grantLevel)).then(() => {
      setGrantAddress('')
      setShowGrantUser(false)
    })
  }

  const handleGrantGroup = (e: React.FormEvent) => {
    e.preventDefault()
    if (grantGroupId === null) return
    void Promise.resolve(onGrantGroup(grantGroupId, grantGroupLevel)).then(() => {
      setGrantGroupId(null)
      setShowGrantGroup(false)
    })
  }

  const totalPerms = access.permissions.length + access.groupPermissions.length

  return (
    <div className="bg-background rounded-lg border p-4">
      <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs">
        <span>Permissions for</span>
        <span className="text-foreground font-semibold">{nodeLabel}</span>
        {totalPerms > 0 && (
          <span className="text-muted-foreground ml-auto text-[11px]">
            {totalPerms} rule{totalPerms !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {protection && (
        <div
          className={`mb-4 rounded-md border p-3 ${
            protection.protected
              ? 'bg-destructive/5 border-destructive/30'
              : 'bg-success/5 border-success/30'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-foreground text-xs font-semibold">
                Protection:{' '}
                <span className={protection.protected ? 'text-destructive' : 'text-success'}>
                  {protection.protected ? 'Protected' : 'Open'}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {protection.protected
                  ? 'Only granted users, group members, the owner, or ADMINS can access.'
                  : 'Any authenticated user can read and write. Anonymous reads allowed.'}
              </p>
            </div>
            {onSetProtection && (
              <AlertDialog
                open={protectionDialog !== null}
                onOpenChange={(o) => !o && setProtectionDialog(null)}
              >
                <Button
                  size="sm"
                  variant={protection.protected ? 'default' : 'destructive'}
                  onClick={() =>
                    setProtectionDialog(protection.protected ? 'unprotect' : 'protect')
                  }
                >
                  {protection.protected ? 'Unprotect' : 'Protect'}
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {protectionDialog === 'protect' ? 'Protect document?' : 'Unprotect document?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {protectionDialog === 'protect'
                        ? 'Only granted users, group members, the owner and ADMINS will be able to access this document.'
                        : 'Any authenticated user will be able to read and write this document, and anonymous reads will be allowed.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AsyncButton
                      size="sm"
                      variant={protectionDialog === 'protect' ? 'destructive' : 'default'}
                      pendingLabel={
                        protectionDialog === 'protect' ? 'Protecting…' : 'Unprotecting…'
                      }
                      onClickAsync={async (e) => {
                        e.preventDefault()
                        await onSetProtection(!protection.protected)
                        setProtectionDialog(null)
                      }}
                    >
                      {protectionDialog === 'protect' ? 'Protect' : 'Unprotect'}
                    </AsyncButton>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-2 text-[11px]">
            <div>
              <span className="text-muted-foreground">Owner: </span>
              {protection.ownerAddress ? (
                <span className="font-mono">
                  <EnsAddress address={protection.ownerAddress} />
                </span>
              ) : (
                <span className="text-muted-foreground">none</span>
              )}{' '}
              <span className="text-muted-foreground">(implicit ADMIN in v6)</span>
            </div>
            {onTransferOwnership && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={() => setTransferOpen(true)}
              >
                Transfer ownership
              </Button>
            )}
          </div>

          {onTransferOwnership && (
            <AlertDialog open={transferOpen} onOpenChange={setTransferOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Transfer ownership</AlertDialogTitle>
                  <AlertDialogDescription>
                    The new owner gains implicit ADMIN access on this document and the existing
                    owner is demoted. This action cannot be undone by Vetra.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={transferAddress}
                  onChange={(e) => setTransferAddress(e.target.value)}
                  placeholder="0x… new owner address"
                  className="font-mono"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AsyncButton
                    size="sm"
                    variant="destructive"
                    pendingLabel="Transferring…"
                    disabled={!transferAddress.trim()}
                    onClickAsync={async (e) => {
                      e.preventDefault()
                      if (!transferAddress.trim()) return
                      await onTransferOwnership(transferAddress.trim())
                      setTransferAddress('')
                      setTransferOpen(false)
                    }}
                  >
                    Transfer
                  </AsyncButton>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {/* Users */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-foreground text-xs font-semibold">Users</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() => setShowGrantUser((v) => !v)}
          >
            {showGrantUser ? 'Cancel' : '+ Add user'}
          </Button>
        </div>

        {showGrantUser && (
          <form
            onSubmit={handleGrantUser}
            className="mb-2 flex flex-wrap items-center gap-2 sm:flex-nowrap"
          >
            <Input
              value={grantAddress}
              onChange={(e) => setGrantAddress(e.target.value)}
              placeholder="0x… wallet address"
              className="h-8 flex-1 font-mono text-xs"
            />
            <Select value={grantLevel} onValueChange={(v) => setGrantLevel(v as PermissionLevel)}>
              <SelectTrigger size="sm" className="h-8 w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="READ">READ</SelectItem>
                <SelectItem value="WRITE">WRITE</SelectItem>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" className="h-8">
              Grant
            </Button>
          </form>
        )}

        {access.permissions.length === 0 ? (
          <p className="text-muted-foreground text-xs">No user permissions set.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {access.permissions.map((p) => (
              <div
                key={p.userAddress}
                className="bg-muted/40 flex items-center gap-2 rounded-md px-2 py-1 text-xs"
              >
                <span className="flex-1 truncate font-mono">
                  <EnsAddress address={p.userAddress} />
                </span>
                <PermissionBadge level={p.permission} />
                <AlertDialog
                  open={revokeUserDialog === p.userAddress}
                  onOpenChange={(o) => !o && setRevokeUserDialog(null)}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10 h-6 px-2 text-[10px]"
                    onClick={() => setRevokeUserDialog(p.userAddress)}
                  >
                    Revoke
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke user permission?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The user will lose their {p.permission} grant on this document. They may
                        retain access via group membership or document-level openness.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AsyncButton
                        size="sm"
                        variant="destructive"
                        pendingLabel="Revoking…"
                        onClickAsync={async (e) => {
                          e.preventDefault()
                          await onRevokeUser(p.userAddress)
                          setRevokeUserDialog(null)
                        }}
                      >
                        Revoke
                      </AsyncButton>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Groups */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-foreground text-xs font-semibold">Groups</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              const next = !showGrantGroup
              setShowGrantGroup(next)
              if (next) onRefreshGroups()
            }}
          >
            {showGrantGroup ? 'Cancel' : '+ Add group'}
          </Button>
        </div>

        {showGrantGroup && (
          <form
            onSubmit={handleGrantGroup}
            className="mb-2 flex flex-wrap items-center gap-2 sm:flex-nowrap"
          >
            <Select
              value={grantGroupId === null ? '' : String(grantGroupId)}
              onValueChange={(v) => setGrantGroupId(v ? parseInt(v, 10) : null)}
            >
              <SelectTrigger size="sm" className="h-8 flex-1">
                <SelectValue placeholder="Select a group…" />
              </SelectTrigger>
              <SelectContent>
                {availableGroups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name} (#{g.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={grantGroupLevel}
              onValueChange={(v) => setGrantGroupLevel(v as PermissionLevel)}
            >
              <SelectTrigger size="sm" className="h-8 w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="READ">READ</SelectItem>
                <SelectItem value="WRITE">WRITE</SelectItem>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" className="h-8" disabled={grantGroupId === null}>
              Grant
            </Button>
          </form>
        )}

        {access.groupPermissions.length === 0 ? (
          <p className="text-muted-foreground text-xs">No group permissions set.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {access.groupPermissions.map((gp) => (
              <div
                key={gp.groupId}
                className="bg-muted/40 flex items-center gap-2 rounded-md px-2 py-1 text-xs"
              >
                <span className="flex-1 truncate">
                  {gp.group.name}{' '}
                  <span className="text-muted-foreground text-[11px]">(#{gp.groupId})</span>
                </span>
                <PermissionBadge level={gp.permission} />
                <AlertDialog
                  open={revokeGroupDialog?.id === gp.groupId}
                  onOpenChange={(o) => !o && setRevokeGroupDialog(null)}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10 h-6 px-2 text-[10px]"
                    onClick={() => setRevokeGroupDialog({ id: gp.groupId, name: gp.group.name })}
                  >
                    Revoke
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke group permission?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Group <span className="font-semibold">{gp.group.name}</span> will lose its{' '}
                        {gp.permission} grant on this document. Members may retain access via direct
                        user grants.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AsyncButton
                        size="sm"
                        variant="destructive"
                        pendingLabel="Revoking…"
                        onClickAsync={async (e) => {
                          e.preventDefault()
                          await onRevokeGroup(gp.groupId)
                          setRevokeGroupDialog(null)
                        }}
                      >
                        Revoke
                      </AsyncButton>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
