'use client'

import { Info } from 'lucide-react'
import type { PublisherTemplate } from '../../types'

type Guard = (title: string, run: () => Promise<unknown>) => void

/** What each owner gets. Task 5 adds services and packages for DEDICATED templates. */
export function TemplateContents({
  template,
}: {
  appId: string
  template: PublisherTemplate
  guard: Guard
}) {
  if (template.mode === 'SHARED') {
    return (
      <p className="bg-muted text-muted-foreground flex gap-2 rounded-lg p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Shared templates do not start anything. Your app decides who gets in by checking whether
        someone holds a licence.
      </p>
    )
  }
  return null
}
