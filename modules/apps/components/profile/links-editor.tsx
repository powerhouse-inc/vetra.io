'use client'

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { newLinkId, PROFILE_LIMITS, type AppProfileLinkDraft } from '../../lib/app-profile/form'

/** Up to 8 labelled links: add, edit, reorder, remove. */
export function LinksEditor({
  links,
  onChange,
  error,
}: {
  links: AppProfileLinkDraft[]
  onChange: (links: AppProfileLinkDraft[]) => void
  error?: string
}) {
  function update(index: number, patch: Partial<AppProfileLinkDraft>) {
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)))
  }

  function move(index: number, by: -1 | 1) {
    const next = [...links]
    const [item] = next.splice(index, 1)
    if (!item) return
    next.splice(index + by, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {links.length === 0 && (
        <p className="text-muted-foreground text-sm">No links yet. Add docs, source code or socials.</p>
      )}
      {links.map((link, index) => (
        <div key={link.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            aria-label={`Link ${index + 1} label`}
            placeholder="Label"
            value={link.label}
            className="sm:w-40"
            onChange={(e) => update(index, { label: e.target.value })}
          />
          <Input
            aria-label={`Link ${index + 1} URL`}
            placeholder="https://"
            type="url"
            inputMode="url"
            value={link.url}
            className="flex-1"
            onChange={(e) => update(index, { url: e.target.value })}
          />
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Move link ${index + 1} up`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Move link ${index + 1} down`}
              disabled={index === links.length - 1}
              onClick={() => move(index, 1)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove link ${index + 1}`}
              onClick={() => onChange(links.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={links.length >= PROFILE_LIMITS.links}
        onClick={() => onChange([...links, { id: newLinkId(), label: '', url: '' }])}
      >
        <Plus className="h-3.5 w-3.5" />
        Add link
      </Button>
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
