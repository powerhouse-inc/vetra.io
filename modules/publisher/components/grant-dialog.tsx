'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { describePublisherError } from '../graphql'
import { useIssueGrant } from '../hooks/use-publisher-mutations'
import type { PublisherLicense, PublisherLicenseType } from '../types'

const schema = z.object({
  user: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, 'Enter a 0x wallet address (42 characters)'),
  licenseTypeId: z.string().min(1, 'Choose a tier'),
})
type Values = z.infer<typeof schema>

/**
 * True when `address` already holds an ACTIVE licence, or an ISSUED one that the
 * provisioning keeper is about to activate (otherwise a second grant inside that
 * window would draw no warning). Case-insensitive: wallets hand
 * us checksummed addresses while the server stores them lowercased.
 */
export function holdsActiveLicense(licenses: PublisherLicense[], address: string): boolean {
  const wanted = address.trim().toLowerCase()
  if (!wanted) return false
  return licenses.some((l) => (l.status === 'ACTIVE' || l.status === 'ISSUED') && l.user.toLowerCase() === wanted)
}

type Props = {
  appId: string
  /** Must be the UNFILTERED licence list, or a status filter would hide the duplicate. */
  licenses: PublisherLicense[]
  types: PublisherLicenseType[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GrantDialog({ appId, licenses, types, open, onOpenChange }: Props) {
  const issue = useIssueGrant(appId)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { user: '', licenseTypeId: '' },
  })
  const address = form.watch('user')
  const duplicate = holdsActiveLicense(licenses, address)
  const activeTiers = types.filter((t) => t.status === 'ACTIVE')

  useEffect(() => {
    if (!open) form.reset()
  }, [open, form])

  const submit = async (v: Values) => {
    try {
      await issue.mutateAsync({ appId, licenseTypeId: v.licenseTypeId, user: v.user.trim() })
      toast.success('Licence granted')
      onOpenChange(false)
    } catch (err) {
      toast.error(describePublisherError(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant licence</DialogTitle>
          <DialogDescription>Give a wallet address access to one of your published tiers.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="user"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Wallet address</FormLabel>
                  <FormControl>
                    <Input placeholder="0x…" autoComplete="off" spellCheck={false} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="licenseTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tier</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Tier">
                        <SelectValue placeholder={activeTiers.length ? 'Choose a tier' : 'No published tiers'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeTiers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label ?? t.kind ?? t.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {duplicate && (
              <Alert variant="destructive">
                <AlertTitle>This address already holds an active or pending licence</AlertTitle>
                <AlertDescription>
                  A pending licence becomes active on the next provisioning tick. Granting another is allowed but does not
                  replace it, and which one applies is not deterministic — revoke the existing licence first if you mean
                  to change their tier.
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="submit" disabled={issue.isPending}>
                {issue.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Grant licence
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
