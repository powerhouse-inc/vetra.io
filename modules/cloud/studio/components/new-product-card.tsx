'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import { StudioCreateForm } from './studio-create-form'

export function NewProductCard({
  onCreate,
  createError,
  hasAttachedKey,
}: {
  onCreate: (apiKey?: string) => Promise<void>
  createError: string | null
  /** When true, the invite code supplies the key — provision directly, no form. */
  hasAttachedKey: boolean
}) {
  const [open, setOpen] = useState(false)

  const card = (
    <button
      onClick={() => (hasAttachedKey ? void onCreate() : setOpen(true))}
      className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-colors"
    >
      <Plus className="h-7 w-7" />
      <span className="text-sm">Create new product…</span>
    </button>
  )

  // Invite code carries the key: clicking provisions immediately (the grid swaps
  // to its "Creating…" state via `creating`). Surface any error beneath the card.
  if (hasAttachedKey) {
    return (
      <div className="flex flex-col gap-2">
        {card}
        {createError && <p className="text-destructive text-sm">{createError}</p>}
      </div>
    )
  }

  // No attached key: collect one manually.
  return (
    <>
      {card}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New product</DialogTitle>
          </DialogHeader>
          <StudioCreateForm onCreate={onCreate} error={createError} />
        </DialogContent>
      </Dialog>
    </>
  )
}
