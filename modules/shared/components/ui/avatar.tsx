'use client'

import * as AvatarPrimitive from '@radix-ui/react-avatar'
import * as React from 'react'

import { cn } from '@/shared/lib/utils'

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
}

// Radix's Image renders null until an onload fires in the browser, so the server
// HTML never carries the src and every avatar paints its fallback first.
function AvatarImage({ className, alt = '', onError, ...props }: React.ComponentProps<'img'>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/image can't SSR-paint here; hosts are unbounded
    <img
      data-slot="avatar-image"
      alt={alt}
      // Opaque, so a transparent source doesn't composite over the fallback behind it.
      className={cn('bg-muted absolute inset-0 aspect-square size-full', className)}
      // Uncover the fallback underneath when the source is broken.
      onError={(event) => {
        event.currentTarget.style.display = 'none'
        onError?.(event)
      }}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn('bg-muted flex size-full items-center justify-center rounded-full', className)}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
