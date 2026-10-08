'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/modules/shared/components/ui/button'
import { Checkbox } from '@/modules/shared/components/ui/checkbox'
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
import { useAddTerm, useSetTermDetails } from '../../hooks/use-publisher-mutations'
import { templateName } from '../../lib/format'
import {
  EMPTY_PLAN,
  ISSUER_OPTIONS,
  kindFromLabel,
  planDetailsInput,
  planInput,
  planSchema,
  publishBlocker,
  termToForm,
  type PlanForm,
} from '../../lib/plan'
import { runWithToast } from '../../lib/run'
import type { PublisherTemplate, PublisherTerm } from '../../types'

const NO_TEMPLATE = '__no_template__'

export function PlanDialog({
  appId,
  term,
  templates,
  templatesUnavailable = false,
  open,
  onOpenChange,
}: {
  appId: string
  /** null = create a new plan. */
  term: PublisherTerm | null
  templates: PublisherTemplate[]
  /** True when the template list failed to load: say so instead of implying there are none. */
  templatesUnavailable?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const add = useAddTerm(appId)
  const update = useSetTermDetails(appId)
  const form = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
    defaultValues: term ? termToForm(term) : EMPTY_PLAN,
  })
  const [kindTouched, setKindTouched] = useState(!!term)
  const kindLocked = !!term && term.status !== 'DRAFT'
  const busy = add.isPending || update.isPending

  useEffect(() => {
    if (open) {
      form.reset(term ? termToForm(term) : EMPTY_PLAN)
    }
  }, [open, term, form])

  const submit = async (values: PlanForm) => {
    // A published plan must stay complete (the server refuses otherwise); say so before sending.
    if (term?.status === 'ACTIVE') {
      const missing = publishBlocker({
        templateId: values.templateId || null,
        issuers: values.issuers,
      })
      if (missing) {
        form.setError(values.templateId ? 'issuers' : 'templateId', {
          message: `${missing} A published plan needs both.`,
        })
        return
      }
    }
    const ok = term
      ? await runWithToast(() => update.mutateAsync(planDetailsInput(term, values)), 'Plan saved')
      : await runWithToast(() => add.mutateAsync(planInput(values)), 'Plan created')
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{term ? 'Edit plan' : 'New plan'}</DialogTitle>
          <DialogDescription>
            A plan decides which template people get, for how long, and how they can get it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Free, Pro, Local-First Conf 2026"
                      autoComplete="off"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        if (!kindTouched) form.setValue('kind', kindFromLabel(e.target.value))
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <FormControl>
                    <Input
                      className="font-mono"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={kindLocked}
                      {...field}
                      onChange={(e) => {
                        setKindTouched(true)
                        field.onChange(e)
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {kindLocked
                      ? 'Published plans keep their kind: existing licences carry it.'
                      : 'The id licences carry. Lowercase, numbers and dashes.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template</FormLabel>
                  <Select
                    value={field.value || NO_TEMPLATE}
                    onValueChange={(v) => field.onChange(v === NO_TEMPLATE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Template" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_TEMPLATE}>Not chosen yet</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {templateName(t)} ({t.mode === 'SHARED' ? 'shared' : 'dedicated'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {templatesUnavailable ? (
                    <FormDescription>
                      Your templates did not load. Close this and try again.
                    </FormDescription>
                  ) : templates.length === 0 ? (
                    <FormDescription>
                      You have no templates yet. Create one in the Templates tab, then pick it here.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="validityDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valid for (days)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      placeholder="No end date"
                      className="w-40"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Counted from the day someone gets the licence.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="issuers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How people get it</FormLabel>
                  <div className="space-y-2">
                    {ISSUER_OPTIONS.map((o) => {
                      const checked = field.value.includes(o.value)
                      return (
                        <label
                          key={o.value}
                          className="border-border flex items-start gap-3 rounded-lg border p-3 data-[disabled=true]:opacity-60"
                          data-disabled={o.disabled ? 'true' : 'false'}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={o.disabled}
                            aria-label={o.label}
                            onCheckedChange={(next) =>
                              field.onChange(
                                next === true
                                  ? [...field.value, o.value]
                                  : field.value.filter((v) => v !== o.value),
                              )
                            }
                          />
                          <span className="space-y-0.5">
                            <span className="block text-sm font-medium">{o.label}</span>
                            <span className="text-muted-foreground block text-xs">{o.hint}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {term ? 'Save plan' : 'Create plan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
