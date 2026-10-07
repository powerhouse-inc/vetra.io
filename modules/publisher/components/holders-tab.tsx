'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { describePublisherError } from '../graphql'
import { usePublisherLicenses, usePublisherLicenseTypes } from '../hooks/use-publisher'
import { useRevokeLicense } from '../hooks/use-publisher-mutations'
import { licenseStatusMeta } from '../lib/status'
import type { PublisherLicense } from '../types'
import { GrantDialog } from './grant-dialog'
import { StatusPill } from './status'

// Mirrors LicenseStatus in the app-owner-license document model. A status missing here
// makes those licences reachable only under ALL.
const FILTERS = ['ALL', 'ISSUED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'REPLACED'] as const

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—')

function RevokeDialog({
  appId,
  license,
  onClose,
}: {
  appId: string
  license: PublisherLicense | null
  onClose: () => void
}) {
  const revoke = useRevokeLicense(appId)
  const [reason, setReason] = useState('')

  const close = () => {
    setReason('')
    onClose()
  }

  const confirm = async () => {
    if (!license) return
    try {
      await revoke.mutateAsync({ licenseId: license.id, reason: reason.trim() || null })
      toast.success('Licence revoked')
      close()
    } catch (err) {
      toast.error(describePublisherError(err))
    }
  }

  return (
    <AlertDialog open={!!license} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this licence?</AlertDialogTitle>
          <AlertDialogDescription>
            Revoking ends this licence. The provisioning keeper will release their environment on its next tick.
            {license && <span className="mt-2 block font-mono text-xs break-all">{license.user}</span>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="revoke-reason" className="text-sm font-medium">
            Reason (optional)
          </label>
          <Input id="revoke-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void confirm()
            }}
            disabled={revoke.isPending}
          >
            {revoke.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Revoke licence
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Holders tab. Reads work with licensing disabled (only writes refuse), so the list
 * always renders and each action surfaces the server's own sentence.
 */
export function HoldersTab({ appId }: { appId: string }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')
  const [grantOpen, setGrantOpen] = useState(false)
  const [revoking, setRevoking] = useState<PublisherLicense | null>(null)
  // The grant dialog's duplicate check needs EVERY licence, whatever the filter shows.
  // With filter ALL both calls share one query key, so this is a single request.
  const all = usePublisherLicenses(appId, null)
  const shown = usePublisherLicenses(appId, filter === 'ALL' ? null : filter)
  const types = usePublisherLicenseTypes(appId)
  const list = shown.data ?? []
  const typeLabel = (id: string) => {
    const t = (types.data ?? []).find((x) => x.id === id)
    return t ? (t.label ?? t.kind ?? id) : id
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Select value={filter} onValueChange={(v) => setFilter(v as (typeof FILTERS)[number])}>
          <SelectTrigger className="w-40" aria-label="Status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {f === 'ALL' ? 'All statuses' : licenseStatusMeta(f).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => setGrantOpen(true)}
          disabled={all.data === undefined}
          title={all.isPending ? 'Loading existing licences…' : undefined}
        >
          <Plus className="h-4 w-4" />
          Grant licence
        </Button>
      </div>
      {all.error && (
        // Grant needs the full licence list to warn about duplicates; say why it is unavailable.
        <p role="alert" className="text-destructive text-sm">
          Granting is unavailable until existing licences load: {describePublisherError(all.error)}
        </p>
      )}
      {types.error && (
        // Without tiers the Tier column falls back to raw ids. Say so, rather than
        // leaving the publisher to read UUIDs and assume that is the tier's name.
        <p role="alert" className="text-destructive text-sm">
          Tier names are unavailable, so the Tier column shows ids: {describePublisherError(types.error)}
        </p>
      )}

      {shown.isPending ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading licences…
        </div>
      ) : shown.error ? (
        <p className="text-destructive py-10 text-center text-sm">{describePublisherError(shown.error)}</p>
      ) : list.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <p className="font-medium">No licences</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            {filter === 'ALL' ? 'Grant a licence to onboard a customer.' : 'No licences match this status.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border-border overflow-x-auto rounded-xl border shadow-sm">
          <Table>
            <TableHeader className="[&_tr]:border-border">
              <TableRow className="border-border">
                <TableHead className="pl-4">Holder</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((l) => (
                <TableRow key={l.id} className="border-border">
                  <TableCell className="pl-4 font-mono text-xs break-all">{l.user}</TableCell>
                  <TableCell>{typeLabel(l.licenseTypeId)}</TableCell>
                  <TableCell>
                    <StatusPill meta={licenseStatusMeta(l.status)} />
                  </TableCell>
                  <TableCell>{fmtDate(l.start)}</TableCell>
                  <TableCell>{fmtDate(l.end)}</TableCell>
                  <TableCell className="font-mono text-xs">{l.environmentId ?? '—'}</TableCell>
                  <TableCell className="pr-4 text-right">
                    {(l.status === 'ACTIVE' || l.status === 'ISSUED') && (
                      <Button variant="outline" size="sm" className="h-7" onClick={() => setRevoking(l)}>
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <GrantDialog
        appId={appId}
        licenses={all.data ?? []}
        types={types.data ?? []}
        open={grantOpen}
        onOpenChange={setGrantOpen}
      />
      <RevokeDialog appId={appId} license={revoking} onClose={() => setRevoking(null)} />
    </div>
  )
}
