'use client'

import { KeyRound, Plus, RefreshCw, Ticket } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { CopyButton } from '@/modules/apps/components/copy-button'
import { StatusPill } from '@/modules/apps/components/status'
import { formatDate } from '@/modules/apps/lib/time'
import { Button } from '@/modules/shared/components/ui/button'
import { Progress } from '@/modules/shared/components/ui/progress'
import { Switch } from '@/modules/shared/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/components/ui/table'
import { usePublisherInviteCodes, usePublisherTerms } from '../../hooks/use-publisher'
import { useSetInviteCodeActive } from '../../hooks/use-publisher-mutations'
import { termName } from '../../lib/format'
import { codePlans, redeemUrl, usesText } from '../../lib/invite-codes'
import { runWithToast } from '../../lib/run'
import { inviteCodeState, inviteCodeStatusMeta } from '../../lib/status'
import { EmptyState, TabError, TabHeader, TabSkeleton } from '../primitives'
import { CreateInviteCodeDialog } from './create-invite-code-dialog'

export function InviteCodesTab({ appId }: { appId: string }) {
  const codes = usePublisherInviteCodes(appId)
  const terms = usePublisherTerms(appId)
  const setActive = useSetInviteCodeActive(appId)
  const [creating, setCreating] = useState(false)
  const list = codes.data ?? []
  const termList = terms.data ?? []
  const plans = codePlans(termList)
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const planName = (kind: string) => {
    const t = termList.find((x) => x.kind === kind)
    return t ? termName(t) : kind
  }

  const createButton = terms.error ? (
    <Button variant="outline" onClick={() => void terms.refetch()}>
      <RefreshCw className="h-4 w-4" />
      Plans did not load. Try again
    </Button>
  ) : terms.isPending ? (
    <Button disabled>
      <Plus className="h-4 w-4" />
      New invite code
    </Button>
  ) : plans.length > 0 ? (
    <Button onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" />
      New invite code
    </Button>
  ) : (
    <Button asChild variant="outline">
      <Link href="?tab=plans">Set up a plan first</Link>
    </Button>
  )

  return (
    <div className="space-y-6">
      <TabHeader
        title="Invite codes"
        description="Share a code or a link. Whoever redeems it gets the plan — no wallet address needed up front."
        action={list.length > 0 && createButton}
      />
      {codes.isPending ? (
        <TabSkeleton label="Loading invite codes" />
      ) : codes.error ? (
        <TabError error={codes.error} onRetry={() => void codes.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={Ticket} title="No invite codes yet" action={createButton}>
          {terms.error
            ? 'We could not load your plans, so we cannot tell what a code could hand out.'
            : plans.length > 0
              ? 'Create a code for a conference, a newsletter or a pilot customer.'
              : 'Invite codes hand out a published plan that allows invite codes. Set one up in Plans.'}
        </EmptyState>
      ) : (
        <div className="bg-card border-border overflow-x-auto rounded-xl border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Code</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => {
                const state = inviteCodeState(c)
                const pct = c.maxUses
                  ? Math.min(100, Math.round((c.redemptions / c.maxUses) * 100))
                  : null
                return (
                  <TableRow key={c.code} data-testid={`code-${c.code}`}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{c.code}</span>
                        {c.hasAnthropicKey && (
                          <span
                            role="img"
                            aria-label="Includes a Claude key"
                            title="Includes a Claude key"
                          >
                            <KeyRound className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
                          </span>
                        )}
                      </div>
                      {c.label && <p className="text-muted-foreground text-xs">{c.label}</p>}
                    </TableCell>
                    <TableCell>{planName(c.kind)}</TableCell>
                    <TableCell className="min-w-32">
                      <p className="text-sm">{usesText(c)}</p>
                      {pct !== null && <Progress value={pct} className="mt-1 h-1.5" aria-hidden />}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {c.expiresAt ? formatDate(c.expiresAt) : 'Never'}
                    </TableCell>
                    <TableCell>
                      <StatusPill meta={inviteCodeStatusMeta(state)} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-3">
                        <CopyButton
                          value={redeemUrl(origin, c.code)}
                          label={`Copy redeem link for ${c.code}`}
                        />
                        <Switch
                          checked={c.active}
                          disabled={setActive.isPending}
                          aria-label={`${c.code} accepting redemptions`}
                          onCheckedChange={(active) =>
                            void runWithToast(
                              () => setActive.mutateAsync({ code: c.code, active }),
                              active ? 'Code resumed' : 'Code paused',
                            )
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <CreateInviteCodeDialog
        appId={appId}
        plans={plans}
        open={creating}
        onOpenChange={setCreating}
      />
    </div>
  )
}
