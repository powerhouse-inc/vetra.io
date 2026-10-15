'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { describeAppsError } from '@/modules/apps/graphql'
import { useCreateStudioApp } from '@/modules/apps/hooks/use-apps'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/modules/shared/components/ui/dialog'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import { APP_NAME_MAX } from '@/modules/apps/components/app-settings'

/**
 * Turns a Studio into an App. The content mounts only while the dialog is open,
 * so a closed trigger on every card costs no hooks or queries.
 */
export function MakeAppDialog({
  studioEnvironmentId,
  label,
}: {
  studioEnvironmentId: string
  label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Make it an App
        </Button>
      </DialogTrigger>
      <DialogContent>
        <MakeAppForm studioEnvironmentId={studioEnvironmentId} label={label} />
      </DialogContent>
    </Dialog>
  )
}

function MakeAppForm({
  studioEnvironmentId,
  label,
}: {
  studioEnvironmentId: string
  label: string
}) {
  const router = useRouter()
  const { orgId } = useActiveOrg()
  const createApp = useCreateStudioApp()
  const [name, setName] = useState(label)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const busy = createApp.isPending || done
  const trimmed = name.trim()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmed || busy) return
    setError(null)
    try {
      const app = await createApp.mutateAsync({ name: trimmed, studioEnvironmentId, orgId })
      setDone(true)
      router.push(`/user/apps/${app.id}`)
    } catch (err) {
      setError(describeAppsError(err))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Make it an App</DialogTitle>
        <DialogDescription>
          Creates a private GitHub repository for this Studio, with Vetra deploys set up: every pull
          request gets a preview, and merging to main ships to production.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="make-app-name">App name</Label>
        <Input
          id="make-app-name"
          value={name}
          maxLength={APP_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={!trimmed || busy}>
          {busy ? 'Creating…' : 'Create App'}
        </Button>
      </DialogFooter>
    </form>
  )
}
