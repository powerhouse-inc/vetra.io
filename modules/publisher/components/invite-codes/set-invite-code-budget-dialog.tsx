'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import { useSetInviteCodeLlmBudget } from '../../hooks/use-publisher-mutations'
import { isBudgetText } from '../../lib/invite-codes'
import { runWithToast } from '../../lib/run'

export function SetInviteCodeBudgetDialog({
  appId,
  code,
  current,
  open,
  onOpenChange,
}: {
  appId: string
  code: string
  /** The code's budget now; null = plan default. */
  current: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const setBudget = useSetInviteCodeLlmBudget(appId)
  const [value, setValue] = useState(current == null ? '' : String(current))

  // Each opening (not each refetch of `current`) starts from the code's current budget.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setValue(current == null ? '' : String(current))
  }

  const text = value.trim()
  const valid = text !== '' && isBudgetText(text)

  const send = async (llmBudgetUsd: number | null, ok: string) => {
    const done = await runWithToast(() => setBudget.mutateAsync({ code, llmBudgetUsd }), ok)
    if (done) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>LLM budget for {code}</DialogTitle>
          <DialogDescription>
            Each Vetra Studio redeemed from this code gets a model key capped at this amount per
            month. Existing Studios pick up a change within 15 minutes.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) void send(Number(text), 'Budget saved')
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invite-code-llm-budget">Monthly LLM budget (USD)</Label>
            <Input
              id="invite-code-llm-budget"
              inputMode="decimal"
              placeholder="20"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {text !== '' && !valid && (
              <p role="alert" className="text-destructive text-sm">
                A dollar amount from 0 to 10,000 (cents at most).
                {text.includes(',') && ' Use a dot, not a comma.'}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={setBudget.isPending}
              onClick={() => void send(null, 'Back on the plan default')}
            >
              Use plan default
            </Button>
            <Button type="submit" disabled={setBudget.isPending || !valid}>
              {setBudget.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save budget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
