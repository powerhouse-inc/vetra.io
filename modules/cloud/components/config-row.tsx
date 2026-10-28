'use client'

import { KeyRound, Loader2, Trash2, Type } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AsyncButton } from '@/modules/cloud/components/async-button'
import type { ConfigEntry } from '@/modules/cloud/config/types'
import { describeCloudError } from '@/modules/cloud/lib/cloud-error'
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
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { TableCell, TableRow } from '@/modules/shared/components/ui/table'
import { cn } from '@/modules/shared/lib/utils'

export type ConfigRowProps = {
  entry: Pick<ConfigEntry, 'name' | 'type' | 'description' | 'required' | 'default'> & {
    /** Human-readable label; the key name then shows beneath it. */
    title?: string
    placeholder?: string
    /** Returns why a value can't be saved, or undefined when it is fine. */
    validate?: (value: string) => string | undefined
  }
  currentValue: string | null
  isSet: boolean
  onSave: (value: string) => Promise<void>
  onDelete: () => Promise<void>
}

/**
 * Single row in a per-package config table — handles inline edit / save /
 * delete for one declared env var or secret. Owns optimistic state so the
 * row reflects the user's input immediately and reverts on error.
 *
 * Used both for per-package config (inside an expanded PackageRow) and for
 * orphan "Unused Config" entries.
 */
export function ConfigRow({ entry, currentValue, isSet, onSave, onDelete }: ConfigRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentValue ?? '')
  // Optimistic overlay — set on save, dropped when the parent's data catches
  // up. `null` outside means "use server-reported state". For vars we hold the
  // typed value; for secrets we just remember "set" (the value is never shown).
  const [optimisticDraft, setOptimisticDraft] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const isVar = entry.type === 'var'
  const effectiveIsSet = optimisticDraft !== null ? true : isSet
  const effectiveValue = optimisticDraft !== null && isVar ? optimisticDraft : currentValue
  const Icon = entry.type === 'secret' ? KeyRound : Type
  const label = entry.title ?? entry.name

  // Drop the optimistic overlay once the server has caught up.
  useEffect(() => {
    if (optimisticDraft === null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isVar && optimisticDraft === currentValue) setOptimisticDraft(null)
    else if (!isVar && isSet) setOptimisticDraft(null)
  }, [optimisticDraft, currentValue, isSet, isVar])

  const handleSave = async () => {
    if (draft.trim().length === 0) {
      toast.error('Value cannot be empty')
      throw new Error('Value cannot be empty')
    }
    const invalid = entry.validate?.(draft)
    if (invalid) {
      toast.error(invalid)
      throw new Error(invalid)
    }
    setOptimisticDraft(draft)
    setEditing(false)
    try {
      await onSave(draft)
      toast.success(`Updated ${label}`)
    } catch (err) {
      setOptimisticDraft(null) // revert
      toast.error(describeCloudError(err, `Couldn't update ${label}. Try again.`))
      throw err instanceof Error ? err : new Error(`Failed to update ${label}`)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
      toast.success(`Deleted ${label}`)
      setConfirmDelete(false)
    } catch (err) {
      toast.error(describeCloudError(err, `Couldn't delete ${label}. Try again.`))
    } finally {
      setIsDeleting(false)
    }
  }

  const needsValue = entry.required && !effectiveIsSet

  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground h-3.5 w-3.5" />
            <span className={cn('text-sm font-medium', !entry.title && 'font-mono')}>{label}</span>
            {entry.required && (
              <Badge size="xs" variant="destructive">
                required
              </Badge>
            )}
          </div>
          {entry.title && (
            <p className="text-muted-foreground font-mono text-[11px]">{entry.name}</p>
          )}
          {entry.description && (
            <p className="text-muted-foreground text-xs">{entry.description}</p>
          )}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <Badge size="xs" variant="outline">
          {entry.type}
        </Badge>
      </TableCell>
      <TableCell className="align-top">
        {editing ? (
          <div className="flex gap-2">
            <Input
              aria-label={`Value for ${label}`}
              type={entry.type === 'secret' ? 'password' : 'text'}
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="font-mono text-sm"
              placeholder={
                entry.type === 'secret'
                  ? 'Enter new value'
                  : (entry.placeholder ?? entry.default ?? '')
              }
            />
            <AsyncButton size="sm" onClickAsync={handleSave} pendingLabel="Saving…">
              Save
            </AsyncButton>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false)
                setDraft(effectiveValue ?? '')
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isVar ? (
              effectiveIsSet ? (
                <span className="font-mono text-sm">{effectiveValue}</span>
              ) : entry.default !== undefined ? (
                <span className="text-muted-foreground text-xs">
                  default <span className="font-mono">{entry.default}</span>
                </span>
              ) : (
                <span className="text-muted-foreground text-xs italic">not set</span>
              )
            ) : effectiveIsSet ? (
              <span className="text-muted-foreground text-xs">&bull;&bull;&bull;&bull;&bull;</span>
            ) : (
              <span className="text-muted-foreground text-xs italic">not set</span>
            )}
            {needsValue && (
              <Badge size="xs" variant="destructive">
                missing
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setDraft(effectiveValue ?? '')
                setEditing(true)
              }}
            >
              {effectiveIsSet ? 'Edit' : 'Set'}
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right align-top">
        {effectiveIsSet && !editing && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive h-7 w-7 p-0"
            onClick={() => setConfirmDelete(true)}
            disabled={isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">Delete {label}</span>
          </Button>
        )}
        <AlertDialog
          open={confirmDelete}
          onOpenChange={(open) => !isDeleting && setConfirmDelete(open)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {entry.type === 'secret' ? 'secret' : 'variable'} {label}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {entry.type === 'secret'
                  ? 'The stored value is removed and cannot be recovered.'
                  : 'The stored value is removed.'}{' '}
                {entry.default !== undefined
                  ? 'The package falls back to its default.'
                  : entry.required
                    ? 'The package needs this value and may stop working until you set it again.'
                    : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  void handleDelete()
                }}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}
