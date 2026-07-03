'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'
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
  variant = 'card',
}: {
  onCreate: (apiKey?: string) => Promise<void>
  createError: string | null
  /** When true, the invite code supplies the key — provision directly, no form. */
  hasAttachedKey: boolean
  /**
   * `card` — dashed tile sized to sit in the products grid.
   * `button` — solid green CTA for the empty state (no products yet).
   * `row` — short dashed button for the bottom "New Vetra Studio…" action,
   *   matching the sibling "New environment…" button's height.
   */
  variant?: 'card' | 'button' | 'row'
}) {
  const [open, setOpen] = useState(false)

  const handleClick = () => (hasAttachedKey ? void onCreate() : setOpen(true))

  const card =
    variant === 'button' ? (
      <Button size="lg" onClick={handleClick}>
        <Plus className="h-5 w-5" />
        Create new product
      </Button>
    ) : variant === 'row' ? (
      <button
        onClick={handleClick}
        className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-5 text-sm font-medium transition-colors"
      >
        <Plus className="h-5 w-5" />
        New Vetra Studio…
      </button>
    ) : (
      <button
        onClick={handleClick}
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
