'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'

export function NewProductCard({
  onCreate,
  createError,
  variant = 'card',
  atLimit = false,
  limit = 0,
}: {
  onCreate: () => Promise<void>
  createError: string | null
  /**
   * `card` — dashed tile sized to sit in the products grid.
   * `button` — solid green CTA for the empty state (no products yet).
   * `row` — short dashed button for the bottom "New studio" action,
   *   matching the sibling "New environment…" button's height.
   */
  variant?: 'card' | 'button' | 'row'
  /** When true, the user hit the create cap — render a disabled limit notice. */
  atLimit?: boolean
  /** The configured cap, shown in the limit-reached copy. */
  limit?: number
}) {
  // Creating provisions immediately: the model key comes from the licence's
  // LLM budget server-side, so there is nothing to ask for.
  const handleClick = () => void onCreate()

  // At the cap: a disabled, non-interactive tile explaining why (no create).
  // Sized per variant so it drops into the same slot as the CTA.
  if (atLimit) {
    const message = `Limit reached — ${limit} of ${limit} studios`
    const shape =
      variant === 'card' ? 'min-h-[200px] flex-col rounded-xl' : 'rounded-2xl py-5 flex-row w-full'
    return (
      <div
        role="note"
        title="Delete a studio to create a new one."
        className={`border-border text-muted-foreground flex cursor-not-allowed items-center justify-center gap-2 border border-dashed px-4 text-sm font-medium opacity-70 ${shape}`}
      >
        {message}
      </div>
    )
  }

  const card =
    variant === 'button' ? (
      <Button size="lg" onClick={handleClick}>
        <Plus className="h-5 w-5" />
        New studio
      </Button>
    ) : variant === 'row' ? (
      <button
        onClick={handleClick}
        className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-5 text-sm font-medium transition-colors"
      >
        <Plus className="h-5 w-5" />
        New studio
      </button>
    ) : (
      <button
        onClick={handleClick}
        className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-colors"
      >
        <Plus className="h-7 w-7" />
        <span className="text-sm">New studio</span>
      </button>
    )

  // The grid swaps to its "Creating…" state via `creating`; surface any error beneath the card.
  return (
    <div className="flex flex-col gap-2">
      {card}
      {createError && <p className="text-destructive text-sm">{createError}</p>}
    </div>
  )
}
