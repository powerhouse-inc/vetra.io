import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

const VARIANTS = {
  primary: 'bg-console-signal text-console-bg hover:bg-console-signal/90 font-semibold',
  secondary: 'border-console-line-strong text-console-ink hover:bg-console-raised border',
} as const

/** Console call-to-action. External hrefs open in a new tab. */
export function CtaLink({
  href,
  children,
  variant = 'secondary',
  className,
}: {
  href: string
  children: ReactNode
  variant?: keyof typeof VARIANTS
  className?: string
}) {
  const classes = cn(
    'inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-[15px] transition-colors',
    VARIANTS[variant],
    className,
  )
  if (href.startsWith('http')) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  )
}
