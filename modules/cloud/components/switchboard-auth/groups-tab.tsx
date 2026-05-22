'use client'

import { ChevronDown, ChevronRight, Plus, Trash2, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AsyncButton } from '@/modules/cloud/components/async-button'
import type { SwitchboardAuthClient } from '@/modules/cloud/lib/switchboard-auth-client'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/modules/shared/components/ui/alert-dialog'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'

import { EnsAddress } from './ens-address'

interface Group {
  id: number
  name: string
  description: string | null
  members: string[]
  createdAt: string
}

interface Props {
  client: SwitchboardAuthClient
}

const GROUPS_QUERY = `{
  groups { id name description members createdAt }
}`

const CREATE_GROUP = `mutation CreateGroup($name: String!, $description: String) {
  createGroup(name: $name, description: $description) {
    id name description members createdAt
  }
}`

const DELETE_GROUP = `mutation DeleteGroup($id: Int!) { deleteGroup(id: $id) }`

const ADD_USER = `mutation AddUser($userAddress: String!, $groupId: Int!) {
  addUserToGroup(userAddress: $userAddress, groupId: $groupId)
}`

const REMOVE_USER = `mutation RemoveUser($userAddress: String!, $groupId: Int!) {
  removeUserFromGroup(userAddress: $userAddress, groupId: $groupId)
}`

export function GroupsTab({ client }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  // Add member form
  const [addMemberGroupId, setAddMemberGroupId] = useState<number | null>(null)
  const [newMemberAddress, setNewMemberAddress] = useState('')

  // Confirmations
  const [deleteDialog, setDeleteDialog] = useState<Group | null>(null)
  const [removeMemberDialog, setRemoveMemberDialog] = useState<{
    groupId: number
    address: string
  } | null>(null)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await client.query<{ groups: Group[] }>(GROUPS_QUERY)
      setGroups(data.groups)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await client.query(CREATE_GROUP, {
        name: newName.trim(),
        description: newDesc.trim() || null,
      })
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      toast.success('Group created')
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create group')
    }
  }

  const handleDeleteGroup = async (id: number) => {
    try {
      await client.query(DELETE_GROUP, { id })
      toast.success('Group deleted')
      await loadGroups()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete group'
      setError(msg)
      toast.error(msg)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberAddress.trim() || addMemberGroupId === null) return
    try {
      await client.query(ADD_USER, {
        userAddress: newMemberAddress.trim(),
        groupId: addMemberGroupId,
      })
      setNewMemberAddress('')
      setAddMemberGroupId(null)
      toast.success('Member added')
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add member')
    }
  }

  const handleRemoveMember = async (groupId: number, address: string) => {
    try {
      await client.query(REMOVE_USER, { userAddress: address, groupId })
      toast.success('Member removed')
      await loadGroups()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to remove member'
      setError(msg)
      toast.error(msg)
    }
  }

  if (loading) {
    return <p className="text-muted-foreground py-6 text-center text-sm">Loading groups…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Groups ({groups.length})</h3>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {showCreate ? 'Cancel' : 'New group'}
        </Button>
      </div>

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-md p-3 text-sm">{error}</div>
      )}

      {showCreate && (
        <form
          onSubmit={(e) => void handleCreateGroup(e)}
          className="bg-muted/30 flex flex-col gap-2 rounded-md border p-3"
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Group name"
            className="h-8 text-sm"
          />
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="h-8 text-sm"
          />
          <Button type="submit" size="sm" className="self-start" disabled={!newName.trim()}>
            Create
          </Button>
        </form>
      )}

      {groups.length === 0 ? (
        <p className="text-muted-foreground rounded-md border p-6 text-center text-sm">
          No groups yet. Create one to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => {
            const isExpanded = expandedGroup === group.id
            return (
              <div key={group.id} className="overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
                    isExpanded ? 'bg-muted/50' : 'hover:bg-muted/30'
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                  )}
                  <span className="text-sm font-semibold">{group.name}</span>
                  {group.description && (
                    <span className="text-muted-foreground text-xs">— {group.description}</span>
                  )}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {isExpanded && (
                  <div className="bg-muted/20 border-t p-3">
                    {group.members.length > 0 ? (
                      <ul className="mb-3 flex flex-col gap-1">
                        {group.members.map((addr) => (
                          <li
                            key={addr}
                            className="bg-background flex items-center gap-2 rounded-md px-2 py-1 text-xs"
                          >
                            <span className="flex-1 truncate font-mono">
                              <EnsAddress address={addr} />
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/40 hover:bg-destructive/10 h-6 px-2 text-[10px]"
                              onClick={() =>
                                setRemoveMemberDialog({ groupId: group.id, address: addr })
                              }
                            >
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground mb-3 text-xs">No members.</p>
                    )}

                    {addMemberGroupId === group.id ? (
                      <form
                        onSubmit={(e) => void handleAddMember(e)}
                        className="flex flex-wrap gap-2 sm:flex-nowrap"
                      >
                        <Input
                          value={newMemberAddress}
                          onChange={(e) => setNewMemberAddress(e.target.value)}
                          placeholder="0x… address"
                          className="h-8 flex-1 font-mono text-xs"
                        />
                        <Button type="submit" size="sm" className="h-8">
                          Add
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => setAddMemberGroupId(null)}
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setAddMemberGroupId(group.id)}
                        >
                          <UserPlus className="h-3.5 w-3.5" /> Add member
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/40 hover:bg-destructive/10 gap-1.5"
                          onClick={() => setDeleteDialog(group)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete group
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete group confirmation */}
      <AlertDialog open={deleteDialog !== null} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && (
                <>
                  Group <span className="font-semibold">{deleteDialog.name}</span> and all of its
                  permission grants will be removed. Members will lose any access derived from this
                  group. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AsyncButton
              size="sm"
              variant="destructive"
              pendingLabel="Deleting…"
              onClickAsync={async (e) => {
                e.preventDefault()
                if (!deleteDialog) return
                await handleDeleteGroup(deleteDialog.id)
                setDeleteDialog(null)
              }}
            >
              Delete
            </AsyncButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member confirmation */}
      <AlertDialog
        open={removeMemberDialog !== null}
        onOpenChange={(o) => !o && setRemoveMemberDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              The user will lose membership in this group and any access derived from group
              permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AsyncButton
              size="sm"
              variant="destructive"
              pendingLabel="Removing…"
              onClickAsync={async (e) => {
                e.preventDefault()
                if (!removeMemberDialog) return
                await handleRemoveMember(removeMemberDialog.groupId, removeMemberDialog.address)
                setRemoveMemberDialog(null)
              }}
            >
              Remove
            </AsyncButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
