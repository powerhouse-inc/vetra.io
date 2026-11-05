import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/shared/lib/utils'

/**
 * Button — primary interactive primitive.
 *
 * Use one of four roles, in order of decreasing emphasis:
 *
 * - `default`     — primary CTA (Vetra brand green). Max one per visible
 *                   surface; the user's main action right now.
 *                   Examples: Manage env, Deploy, Approve, modal Save.
 * - `outline`     — secondary action / navigation peer of primary.
 *                   Examples: Visit, Details, Add, Cancel.
 * - `ghost`       — low-emphasis in-row tools, icon-only utilities.
 *                   Examples: `⋮` dropdown triggers, copy buttons.
 * - `destructive` — final commit step of a destructive flow (inside an
 *                   AlertDialog). NOT the pre-confirm trigger.
 *                   Examples: AlertDialogAction for Delete / Uninstall.
 *
 * `secondary` and `link` exist for legacy uses; avoid for new code.
 *
 * Sizes by surface:
 * - `sm`      — compact rows, table actions (default for most cloud UI).
 * - `default` — modal / dialog footer CTAs.
 * - `lg`      — landing-page hero CTAs.
 * - `icon`    — square icon-only buttons.
 *
 * Disabled buttons fade (and the primary one turns neutral grey) and ignore the pointer.
 *
 * Async clicks should use <AsyncButton> from `@/modules/cloud/components/async-button`
 * — it provides the pending spinner + disable while a mutation is in flight.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        // Half-opacity brand green still reads as clickable on the dark console, so a
        // disabled primary turns neutral instead.
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
