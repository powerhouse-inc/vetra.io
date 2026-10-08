'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { CopyButton } from '@/modules/apps/components/copy-button'
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
import { useCreateInviteCode } from '../../hooks/use-publisher-mutations'
import { termName } from '../../lib/format'
import {
  inviteCodeInput,
  inviteCodeSchema,
  redeemUrl,
  type InviteCodeForm,
} from '../../lib/invite-codes'
import { runWithToast } from '../../lib/run'
import type { PublisherInviteCode, PublisherTerm } from '../../types'

const EMPTY: InviteCodeForm = {
  kind: '',
  label: '',
  code: '',
  maxUses: '',
  expiresOn: '',
  anthropicKey: '',
}

export function CreateInviteCodeDialog({
  appId,
  plans,
  open,
  onOpenChange,
}: {
  appId: string
  /** Published plans that allow invite codes. */
  plans: PublisherTerm[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateInviteCode(appId)
  const form = useForm<InviteCodeForm>({
    resolver: zodResolver(inviteCodeSchema),
    defaultValues: EMPTY,
  })
  const [created, setCreated] = useState<PublisherInviteCode | null>(null)
  // Each opening is a session; a result that lands after the dialog closed belongs to an old one.
  const session = useRef(0)
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  // The "ready" view stays up while the dialog animates out, and is cleared on the next open.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setCreated(null)
  }

  useEffect(() => {
    // Fresh form each time it opens.
    if (!open) return
    session.current += 1
    form.reset(EMPTY)
  }, [open, form])

  const only = plans.length === 1 ? plans[0].kind : ''
  useEffect(() => {
    // A single plan is chosen for them, also when the plans arrive after opening. Only fills an
    // empty field, so it never wipes what they typed.
    if (open && only && !form.getValues('kind')) form.setValue('kind', only)
  }, [open, only, form])

  const submit = async (v: InviteCodeForm) => {
    const mine = session.current
    await runWithToast(async () => {
      const code = await create.mutateAsync(inviteCodeInput(v))
      if (session.current !== mine || !openRef.current) return
      setCreated(code)
      // The Claude key is write-only: drop it from the form as soon as it is sent.
      form.reset({ ...EMPTY, kind: only })
    }, 'Invite code created')
  }

  const link = created
    ? redeemUrl(typeof window === 'undefined' ? '' : window.location.origin, created.code)
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="text-success h-5 w-5" aria-hidden />
                Your code is ready
              </DialogTitle>
              <DialogDescription>
                Share the link. People log in with Renown and get the plan.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="bg-muted rounded-lg px-3 py-4 text-center font-mono text-2xl font-semibold tracking-wide break-all">
                {created.code}
              </p>
              {created.hasAnthropicKey && (
                <p className="text-muted-foreground text-center text-sm">
                  Includes a Claude key for Vetra Studio plans.
                </p>
              )}
              <div className="border-border flex items-center gap-2 rounded-lg border px-3 py-2">
                <span className="text-muted-foreground min-w-0 flex-1 font-mono text-xs break-all">
                  {link}
                </span>
                <CopyButton value={link} label="Copy redeem link" showLabel />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New invite code</DialogTitle>
              <DialogDescription>
                Anyone with the code gets the plan, until it runs out or expires.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              {/* `submit` reads its refs after the mutation settles, never during render. */}
              {/* eslint-disable-next-line react-hooks/refs */}
              <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger aria-label="Plan" className="w-full">
                            <SelectValue placeholder="Choose a plan" />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Speakers, Newsletter October"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom code (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Leave empty for a random code"
                          className="font-mono"
                          autoComplete="off"
                          spellCheck={false}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        8–64 letters, numbers, dashes or underscores. Capitals count.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="maxUses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum uses</FormLabel>
                        <FormControl>
                          <Input
                            inputMode="numeric"
                            placeholder="No limit"
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expiresOn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expires on</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="anthropicKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Claude API key (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="off"
                          placeholder="sk-ant-…"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        For Vetra Studio plans: people who redeem get this key in their studio.
                        Stored encrypted and never shown again.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create code
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
