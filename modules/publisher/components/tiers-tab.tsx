'use client'

import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { describePublisherError } from '../graphql'
import { usePublisherLicenseTypes } from '../hooks/use-publisher'
import { usePublishLicenseType, useRetireLicenseType } from '../hooks/use-publisher-mutations'
import { tierStatusMeta } from '../lib/status'
import type { PublisherLicenseType } from '../types'
import { CreateTierDialog } from './create-tier-dialog'
import { StatusPill } from './status'
import { NOT_PROVISIONABLE, TierDetail } from './tier-detail'

type Pending = { action: 'publish' | 'retire'; tier: PublisherLicenseType }

function ConfirmDialog({ appId, pending, onClose }: { appId: string; pending: Pending | null; onClose: () => void }) {
  const publish = usePublishLicenseType(appId)
  const retire = useRetireLicenseType(appId)
  const busy = publish.isPending || retire.isPending
  const name = pending?.tier.label ?? pending?.tier.kind ?? 'this tier'

  const confirm = async () => {
    if (!pending) return
    try {
      if (pending.action === 'publish') {
        await publish.mutateAsync(pending.tier.id)
        toast.success(`${name} published`)
      } else {
        await retire.mutateAsync(pending.tier.id)
        toast.success(`${name} retired`)
      }
      onClose()
    } catch (err) {
      toast.error(describePublisherError(err))
    }
  }

  let title = ''
  let body: ReactNode = null
  if (pending?.action === 'retire') {
    title = `Retire ${name}?`
    body = (
      <>
        Retiring stops new grants of this tier. <strong>Existing holders keep their environments</strong> — revoke a
        licence to end service for a holder.
      </>
    )
  } else if (pending?.action === 'publish') {
    title = `Publish ${name}?`
    body =
      pending.tier.status === 'RETIRED' ? (
        <>
          This tier is retired. Publishing will <strong>reactivate</strong> it and allow new grants again.
        </>
      ) : (
        <>Publishing makes this tier available for new grants.</>
      )
  }

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void confirm()
            }}
            disabled={busy}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending?.action === 'retire' ? 'Retire tier' : 'Publish tier'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function servicesLabel(t: PublisherLicenseType): string {
  if (t.services.length === 0) return '—'
  return t.services.map((s) => (NOT_PROVISIONABLE.has(s.type) ? `${s.type} (not provisionable)` : s.type)).join(', ')
}

/**
 * Tiers tab. A deployment with licensing disabled still serves reads, so the list
 * renders normally and each action surfaces the server's refusal; there is
 * deliberately no global "licensing is off" guard here.
 */
export function TiersTab({ appId }: { appId: string }) {
  const types = usePublisherLicenseTypes(appId)
  const [pending, setPending] = useState<Pending | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const list = types.data ?? []
  const editing = list.find((t) => t.id === editingId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">
            Tiers are append-only: a service or package added by mistake cannot be removed — retire the tier and
            replace it.
          </p>
          <p className="text-muted-foreground text-sm">
            Service types: CONNECT, SWITCHBOARD, FUSION and CLINT. CLINT is not provisionable yet — the licensing API
            refuses it.
          </p>
        </div>
        <CreateTierDialog appId={appId} />
      </div>

      {types.isPending ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading tiers…
        </div>
      ) : types.error ? (
        <p className="text-destructive py-10 text-center text-sm">{describePublisherError(types.error)}</p>
      ) : list.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <p className="font-medium">No tiers yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">Create a tier to define what customers can be granted.</p>
        </div>
      ) : (
        <div className="bg-card border-border overflow-x-auto rounded-xl border shadow-sm">
          <Table>
            <TableHeader className="[&_tr]:border-border">
              <TableRow className="border-border">
                <TableHead className="pl-4">Label</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Packages</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((t) => (
                <TableRow key={t.id} className="border-border">
                  <TableCell className="pl-4 font-medium">{t.label ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{t.kind ?? '—'}</TableCell>
                  <TableCell>
                    <StatusPill meta={tierStatusMeta(t.status)} />
                  </TableCell>
                  <TableCell>{t.validityDays == null ? '—' : `${t.validityDays} days`}</TableCell>
                  <TableCell className="text-xs">{servicesLabel(t)}</TableCell>
                  <TableCell>{t.packages.length}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditingId(t.id)}>
                        Edit
                      </Button>
                      {(t.status === 'DRAFT' || t.status === 'RETIRED') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => setPending({ action: 'publish', tier: t })}
                        >
                          Publish
                        </Button>
                      )}
                      {t.status === 'ACTIVE' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => setPending({ action: 'retire', tier: t })}
                        >
                          Retire
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog appId={appId} pending={pending} onClose={() => setPending(null)} />
      <TierDetail appId={appId} tier={editing} onClose={() => setEditingId(null)} />
    </div>
  )
}
