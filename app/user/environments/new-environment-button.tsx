'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { ComponentProps } from 'react'

import { canOfferCreateApp } from '@/modules/orgs/types'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import { Button } from '@/modules/shared/components/ui/button'

/**
 * "New environment", gated like the "New app" tile: a plain member of the active
 * organisation cannot create there (the form would refuse), so they get a disabled
 * button that says who can.
 */
export function NewEnvironmentButton({
  variant,
  size,
}: Pick<ComponentProps<typeof Button>, 'variant' | 'size'>) {
  const { org } = useActiveOrg()
  if (org && !canOfferCreateApp(org.role)) {
    const reason = `Ask an owner or admin of ${org.name} to create environments`
    // A disabled button gets no pointer events, so the tooltip sits on a wrapper.
    return (
      <span title={reason} className="inline-flex">
        <Button variant={variant} size={size} disabled aria-description={reason}>
          <Plus className="h-4 w-4" />
          New environment
        </Button>
      </span>
    )
  }
  return (
    <Button asChild variant={variant} size={size}>
      <Link href="/user/environments/new">
        <Plus className="h-4 w-4" />
        New environment
      </Link>
    </Button>
  )
}
