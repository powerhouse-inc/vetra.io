'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert, AlertDescription, AlertTitle } from '@/modules/shared/components/ui/alert'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/modules/shared/components/ui/form'
import { Input } from '@/modules/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'
import { useAddToAllowList, useIssueGrant } from '../../hooks/use-publisher-mutations'
import { termName } from '../../lib/format'
import { grantablePlans, isOnAllowList, liveLicenseOf, modeOfKind, USER_PATTERN } from '../../lib/holders'
import { runWithToast } from '../../lib/run'
import type {
  PublisherAllowListEntry,
  PublisherLicense,
  PublisherTemplate,
  PublisherTerm,
} from '../../types'

const schema = z.object({
  user: z.string().trim().regex(USER_PATTERN, 'Enter a 0x wallet address or a did:pkh:eip155 DID'),
  kind: z.string().min(1, 'Choose a plan'),
  label: z.string().trim().max(60, 'Keep it under 60 characters'),
})
type Values = z.infer<typeof schema>

export function GrantDialog({
  appId,
  open,
  onOpenChange,
  licenses,
  terms,
  templates,
  allowList,
  loadError = false,
  loadFailed = false,
  onRetry,
}: {
  appId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Every licence of the app (unfiltered), for the "already holds" check. */
  licenses: PublisherLicense[]
  terms: PublisherTerm[]
  templates: PublisherTemplate[]
  allowList: PublisherAllowListEntry[]
  /** Plans or the allow list are not available yet (loading or failed): granting waits. */
  loadError?: boolean
  /** True when that is a failure rather than still loading. */
  loadFailed?: boolean
  onRetry?: () => void
}) {
  const issue = useIssueGrant(appId)
  const allow = useAddToAllowList(appId)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { user: '', kind: '', label: '' } })
  const plans = grantablePlans(terms)
  const user = form.watch('user').trim()
  const kind = form.watch('kind')
  const validUser = USER_PATTERN.test(user)
  const existing = validUser ? liveLicenseOf(licenses, user) : undefined
  const needsAllowList = validUser && !loadError && !isOnAllowList(allowList, user)
  const dedicated = modeOfKind(kind, terms, templates) === 'DEDICATED'
  const busy = issue.isPending || allow.isPending

  useEffect(() => {
    if (!open) form.reset()
  }, [open, form])

  const submit = async (v: Values) => {
    const ok = await runWithToast(async () => {
      // The server only grants to people on the allow list (NOT_ON_ALLOW_LIST).
      if (needsAllowList) await allow.mutateAsync({ user: v.user.trim() })
      await issue.mutateAsync({
        kind: v.kind,
        user: v.user.trim(),
        label: dedicated ? v.label.trim() || null : null,
      })
    }, 'Licence granted')
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant a licence</DialogTitle>
          <DialogDescription>Give someone one of your published plans.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="user"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Wallet address or DID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0x… or did:pkh:eip155:1:0x…"
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  {needsAllowList && (
                    <FormDescription className="flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" aria-hidden />
                      Not on your allow list yet — they will be added to your allow list when you grant.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Plan" className="w-full">
                        <SelectValue placeholder={plans.length ? 'Choose a plan' : 'No plan allows grants yet'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {plans.map((t) => (
                        <SelectItem key={t.id} value={t.kind}>
                          {termName(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {plans.length === 0 && !loadError && (
                    <FormDescription>Publish a plan with “Granted by you” switched on first.</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            {dedicated && (
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project name</FormLabel>
                    <FormControl>
                      <Input placeholder="Shown as their environment’s name" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {existing && (
              <Alert>
                <AlertTitle>Already holds {termName(terms.find((t) => t.kind === existing.kind) ?? { label: null, kind: existing.kind })}</AlertTitle>
                <AlertDescription>
                  Granting gives them a second licence and a second environment. To move them to
                  another plan and keep their environment, use “Change plan” on their row.
                </AlertDescription>
              </Alert>
            )}
            {loadFailed && (
              <p role="alert" className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                Your plans or allow list did not load, so granting is paused.
                <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                  Try again
                </Button>
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={busy || plans.length === 0 || loadError}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {needsAllowList ? 'Add to allow list and grant' : 'Grant licence'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
