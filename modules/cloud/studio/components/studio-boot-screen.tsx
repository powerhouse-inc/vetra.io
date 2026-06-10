'use client'

import { Loader2 } from 'lucide-react'

export function StudioBootScreen({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      <p className="text-sm font-medium">{title}</p>
      {detail && <p className="text-muted-foreground max-w-sm text-xs">{detail}</p>}
    </div>
  )
}
