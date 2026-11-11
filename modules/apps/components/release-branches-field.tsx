'use client'

import { X } from 'lucide-react'
import { useId, useState } from 'react'

import { Label } from '@/modules/shared/components/ui/label'

// Mirror the vetra-apps subgraph's releaseBranches validation.
export const RELEASE_BRANCHES_MAX = 20
export const RELEASE_BRANCH_MAX_LENGTH = 255

/** Why `name` can't be added to `existing`, or `null` when it can. */
export function validateReleaseBranch(name: string, existing: string[]): string | null {
  if (!name) return 'Enter a branch name.'
  if (/\s/.test(name)) return 'Branch names cannot contain spaces.'
  if (name.includes('**')) return 'Use a single * per segment; ** is not supported.'
  if (name.length > RELEASE_BRANCH_MAX_LENGTH)
    return `Branch names are at most ${RELEASE_BRANCH_MAX_LENGTH} characters.`
  if (existing.includes(name)) return `${name} is already in the list.`
  if (existing.length >= RELEASE_BRANCHES_MAX)
    return `At most ${RELEASE_BRANCHES_MAX} release branches.`
  return null
}

export function ReleaseBranchesField({
  value,
  onChange,
  readOnly,
  serverError,
}: {
  value: string[]
  onChange: (next: string[]) => void
  readOnly?: boolean
  serverError?: string | null
}) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Adds each comma-separated entry; stops (keeping the rest as the draft) at the first invalid one.
  const commit = (text: string) => {
    const parts = text.split(',').map((p) => p.trim())
    let list = value
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]) continue
      const problem = validateReleaseBranch(parts[i], list)
      if (problem) {
        onChange(list)
        setDraft(parts.slice(i).join(','))
        setError(problem)
        return
      }
      list = [...list, parts[i]]
    }
    onChange(list)
    setDraft('')
    setError(null)
  }

  const shown = error ?? serverError

  return (
    <div className="space-y-2">
      <Label htmlFor={readOnly ? undefined : id}>Release branches</Label>
      <div
        className={
          readOnly
            ? 'flex flex-wrap items-center gap-1.5'
            : 'border-input bg-background flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5'
        }
      >
        {value.map((b) => (
          <span
            key={b}
            className="bg-muted inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 font-mono text-xs"
          >
            {b}
            {!readOnly && (
              <button
                type="button"
                aria-label={`Remove ${b}`}
                className="text-muted-foreground hover:text-foreground rounded p-0.5"
                onClick={() => onChange(value.filter((x) => x !== b))}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {readOnly && value.length === 0 && (
          <span className="text-muted-foreground text-xs">None</span>
        )}
        {!readOnly && (
          <input
            id={id}
            value={draft}
            placeholder={value.length === 0 ? 'next, 1.x, release/*' : undefined}
            className="min-w-24 flex-1 bg-transparent font-mono text-sm outline-none"
            aria-invalid={!!shown}
            autoComplete="off"
            onChange={(e) => {
              if (e.target.value.includes(',')) commit(e.target.value)
              else {
                setDraft(e.target.value)
                setError(null)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (draft.trim()) commit(draft)
              } else if (e.key === 'Backspace' && !draft && value.length > 0) {
                onChange(value.slice(0, -1))
              }
            }}
            onBlur={() => {
              if (draft.trim()) commit(draft)
            }}
          />
        )}
      </div>
      {shown && (
        <p role="alert" className="text-destructive text-xs">
          {shown}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Branches listed here may publish releases, such as next for prereleases or 1.x for
        maintenance. The production branch always can. Use exact names or patterns where{' '}
        <code className="font-mono">*</code> matches within one path segment (
        <code className="font-mono">*.x</code>, <code className="font-mono">release/*</code>). Up to{' '}
        {RELEASE_BRANCHES_MAX}.
      </p>
    </div>
  )
}
