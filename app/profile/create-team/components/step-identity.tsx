'use client'
import { Check, Loader2, X } from 'lucide-react'
import type { SlugStatus } from '@/modules/profile/lib/use-slug-availability'
import { slugify } from '@/modules/profile/lib/validations'
import { cn } from '@/modules/shared/lib/utils'

export function StepIdentity({
  name,
  slug,
  slugStatus,
  onChange,
}: {
  name: string
  slug: string
  slugStatus: SlugStatus
  onChange: (next: { name: string; slug: string }) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="team-name" className="mb-1 block text-sm font-medium">
          Team name
        </label>
        <input
          id="team-name"
          className="bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          placeholder="Acme Corp"
          value={name}
          maxLength={60}
          onChange={(e) => {
            const nextName = e.target.value
            const previousAuto = slugify(name)
            const next = slug === previousAuto || slug === '' ? slugify(nextName) : slug
            onChange({ name: nextName, slug: next })
          }}
        />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="team-slug" className="text-sm font-medium">
            URL slug
          </label>
          <SlugStatusBadge status={slugStatus} />
        </div>
        <div className="bg-background focus-within:ring-primary flex items-stretch rounded-md border focus-within:ring-2">
          <span className="text-muted-foreground border-r px-3 py-2 text-sm">
            vetra.to/builders/
          </span>
          <input
            id="team-slug"
            className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
            placeholder="acme-corp"
            value={slug}
            maxLength={40}
            onChange={(e) => onChange({ name, slug: e.target.value })}
          />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Lowercase letters, numbers, and dashes. 3–40 characters.
        </p>
      </div>
    </div>
  )
}

function SlugStatusBadge({ status }: { status: SlugStatus }) {
  if (status === 'idle') return null
  const map = {
    checking: {
      icon: <Loader2 className="size-3 animate-spin" />,
      label: 'Checking',
      cls: 'text-muted-foreground',
    },
    available: {
      icon: <Check className="size-3" />,
      label: 'Available',
      cls: 'text-green-600 dark:text-green-500',
    },
    taken: { icon: <X className="size-3" />, label: 'Taken', cls: 'text-destructive' },
    error: {
      icon: <X className="size-3" />,
      label: "Couldn't check",
      cls: 'text-muted-foreground',
    },
  }[status]
  return (
    <span className={cn('flex items-center gap-1 text-xs font-medium', map.cls)}>
      {map.icon}
      {map.label}
    </span>
  )
}
