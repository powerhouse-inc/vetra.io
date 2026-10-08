'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/modules/shared/components/ui/form'
import { Input } from '@/modules/shared/components/ui/input'
import { useAddTemplate } from '../../hooks/use-publisher-mutations'
import { runWithToast } from '../../lib/run'
import { ModeChoice } from './mode-choice'

const schema = z.object({
  name: z.string().trim().max(60, 'Keep it under 60 characters'),
  mode: z.enum(['SHARED', 'DEDICATED']),
})
type Values = z.infer<typeof schema>

export function CreateTemplateDialog({
  appId,
  open,
  onOpenChange,
  onCreated,
}: {
  appId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (templateId: string) => void
}) {
  const add = useAddTemplate(appId)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', mode: 'SHARED' },
  })

  useEffect(() => {
    if (!open) form.reset()
  }, [open, form])

  const submit = async (v: Values) => {
    let id = ''
    const ok = await runWithToast(async () => {
      id = await add.mutateAsync({ name: v.name.trim() || null, mode: v.mode })
    }, 'Template created')
    if (ok) {
      onOpenChange(false)
      onCreated(id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>
            Decide how owners use your app. You can add services and packages next.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Community, Pro workspace"
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
              name="mode"
              render={({ field }) => <ModeChoice value={field.value} onChange={field.onChange} />}
            />
            <DialogFooter>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create template
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
