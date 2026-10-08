'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { formatDate } from '@/modules/apps/lib/time'
import { describePublisherError } from '../../graphql'
import { useAddToAllowList, useRemoveFromAllowList } from '../../hooks/use-publisher-mutations'
import { shortDid } from '../../lib/format'
import { USER_PATTERN } from '../../lib/holders'
import { runWithToast } from '../../lib/run'
import type { PublisherAllowListEntry } from '../../types'
import { SectionCard } from '../primitives'

export function AllowListCard({
  appId,
  entries,
  error = null,
  onRetry,
}: {
  appId: string
  /** undefined while the list has not loaded. */
  entries: PublisherAllowListEntry[] | undefined
  error?: unknown
  onRetry?: () => void
}) {
  const add = useAddToAllowList(appId)
  const remove = useRemoveFromAllowList(appId)
  const [user, setUser] = useState('')
  const valid = USER_PATTERN.test(user.trim())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const ok = await runWithToast(
      () => add.mutateAsync({ user: user.trim() }),
      'Added to the allow list',
    )
    if (ok) setUser('')
  }

  return (
    <SectionCard
      title="Allow list"
      description="You can only grant licences to people on this list. Granting adds them automatically."
    >
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Add to allow list"
          placeholder="0x… or did:pkh:eip155:1:0x…"
          className="font-mono"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!valid || add.isPending}>
          {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add
        </Button>
      </form>
      {entries === undefined ? (
        error ? (
          <div
            role="alert"
            className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm"
          >
            {describePublisherError(error)}
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : (
          <p role="status" className="text-muted-foreground text-sm">
            Loading the allow list…
          </p>
        )
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nobody on the list yet.</p>
      ) : (
        <ul className="divide-border divide-y text-sm">
          {entries.map((e) => (
            <li key={e.user} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 font-mono text-xs break-all">{shortDid(e.user)}</span>
              <span className="text-muted-foreground hidden text-xs sm:inline">
                Added {formatDate(e.addedAt)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${e.user} from the allow list`}
                disabled={remove.isPending}
                onClick={() =>
                  void runWithToast(
                    () => remove.mutateAsync({ user: e.user }),
                    'Removed from the allow list',
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
