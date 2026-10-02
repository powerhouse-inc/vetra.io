'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/modules/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export function CopyButton({
  value,
  label = 'Copy',
  className,
  showLabel = false,
}: {
  value: string
  label?: string
  className?: string
  showLabel?: boolean
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      /* clipboard blocked (insecure context) — the text stays selectable */
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? 'sm' : 'icon'}
      onClick={() => void copy()}
      aria-label={copied ? 'Copied' : label}
      className={cn(
        'text-muted-foreground hover:text-foreground',
        !showLabel && 'h-8 w-8',
        className,
      )}
    >
      {copied ? <Check className="text-success h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {showLabel && <span>{copied ? 'Copied' : label}</span>}
    </Button>
  )
}
