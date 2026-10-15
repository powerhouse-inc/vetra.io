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
import { useSetInviteCodeAnthropicKey } from '../../hooks/use-publisher-mutations'
import { runWithToast } from '../../lib/run'

export function SetInviteCodeKeyDialog({
  appId,
  code,
  open,
  onOpenChange,
}: {
  appId: string
  code: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const setKey = useSetInviteCodeAnthropicKey(appId)
  const [key, setKeyValue] = useState('')

  // The Claude key is write-only: whichever way the dialog closes, drop it.
  const close = (next: boolean) => {
    if (!next) setKeyValue('')
    onOpenChange(next)
  }

  const send = async (anthropicKey: string | null, ok: string) => {
    const done = await runWithToast(() => setKey.mutateAsync({ code, anthropicKey }), ok)
    if (done) close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Claude key for {code}</DialogTitle>
          <DialogDescription>
            For Vetra Studio plans: people who redeem get this key in their studio. Stored encrypted
            and never shown again.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (key.trim()) void send(key.trim(), 'Claude key saved')
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invite-code-anthropic-key">Claude API key</Label>
            <Input
              id="invite-code-anthropic-key"
              type="password"
              autoComplete="off"
              placeholder="sk-ant-…"
              value={key}
              onChange={(e) => setKeyValue(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={setKey.isPending}
              onClick={() => void send(null, 'Claude key removed')}
            >
              Remove key
            </Button>
            <Button type="submit" disabled={setKey.isPending || !key.trim()}>
              {setKey.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
