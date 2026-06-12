import Link from 'next/link'
import React from 'react'
import { cn } from '@/modules/shared/lib/utils'
import type { RouteWithDynamicPages } from '@/modules/shared/types/routes'

interface NavbarBrandProps {
  isAchraPage: boolean
  isotypeLogo?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  logotype?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  logotypeClassName?: string
  logoHref?: RouteWithDynamicPages
}

export function NavbarBrand({
  isAchraPage,
  isotypeLogo: IsotypeLogo,
  logotype: Logotype,
  logotypeClassName,
  logoHref,
}: NavbarBrandProps) {
  const showIsotype = !isAchraPage && IsotypeLogo && Logotype

  return (
    <div className="flex items-center gap-4 p-4 md:gap-6">
      {showIsotype && logoHref && (
        <Link href={logoHref} className="cursor-pointer hover:opacity-80">
          <div className="flex items-center">
            {/* Show icon only on mobile */}
            {typeof IsotypeLogo === 'function' && <IsotypeLogo className="h-8 w-8 md:hidden" />}
            {/* Show full logo with text on desktop */}
            {typeof Logotype === 'function' && (
              <Logotype className={cn('text-foreground hidden h-8 md:block', logotypeClassName)} />
            )}
          </div>
        </Link>
      )}
    </div>
  )
}
