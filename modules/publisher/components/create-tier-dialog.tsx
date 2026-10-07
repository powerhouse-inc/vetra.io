'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { describePublisherError } from '../graphql'
import { useCreateLicenseType } from '../hooks/use-publisher-mutations'

const schema = z.object({
  kind: z.string().trim().min(1, 'Kind is required'),
  label: z.string(),
  validityDays: z
    .string()
    .refine((v) => v.trim() === '' || (/^\d+$/.test(v.trim()) && Number(v) > 0), 'Enter a whole number of days'),
})
type Values = z.infer<typeof schema>

export function CreateTierDialog({ appId }: { appId: string }) {
  const [open, setOpen] = useState(false)
  const create = useCreateLicenseType(appId)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { kind: '', label: '', validityDays: '' },
  })

  const submit = async (v: Values) => {
    try {
      await create.mutateAsync({
        appId,
        kind: v.kind.trim(),
        label: v.label.trim() || null,
        validityDays: v.validityDays.trim() ? Number(v.validityDays) : null,
      })
      toast.success('Tier created as a draft')
      form.reset()
      setOpen(false)
    } catch (err) {
      toast.error(describePublisherError(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          New tier
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New tier</DialogTitle>
          <DialogDescription>
            A new tier starts as a draft. Add its services and packages, then publish it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <FormControl>
                    <Input placeholder="PRO" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder="Pro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="validityDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validity (days)</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="365" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create tier
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
