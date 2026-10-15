'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { describeCreateStudioAppError, isAppsError } from '@/modules/apps/graphql'
import {
  useCreateStudioApp,
  useGithubDeployAppInfo,
  useMyApps,
  useMyGithubDeployInstallations,
} from '@/modules/apps/hooks/use-apps'
import { ConnectGithub } from '@/modules/apps/components/repo-picker'
import { ReconnectGithub } from '@/modules/apps/components/reconnect-github'
import { canOfferCreateApp } from '@/modules/orgs/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'
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
  const { data: apps } = useMyApps()
  // A Studio that is already an App links to it instead of offering a second one.
  const existing = apps?.find((a) => a.studioEnvironmentId === studioEnvironmentId)
  if (existing) {
    return (
      <Link
        href={`/user/apps/${existing.id}`}
        className="text-muted-foreground text-sm hover:underline"
      >
        Open App
      </Link>
    )
  }
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
  const { orgId, org } = useActiveOrg()
  const createApp = useCreateStudioApp()
  const [name, setName] = useState(label)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pickedInstallation, setPickedInstallation] = useState<string | null>(null)
  const info = useGithubDeployAppInfo()
  const installations = useMyGithubDeployInstallations()
  const list = installations.data ?? []
  const installation = list.find((i) => i.installationId === pickedInstallation) ?? list[0] ?? null
  const [createNotConnected, setCreateNotConnected] = useState(false)
  const notConnected =
    createNotConnected || isAppsError(installations.error, 'GITHUB_NOT_CONNECTED')
  const busy = createApp.isPending || done
  const trimmed = name.trim()
  // An org context still loading cannot create: its role is unknown.
  const orgPending = !!orgId && !org
  const roleBlocked = !!org && !canOfferCreateApp(org.role)
  const blocked = orgPending || roleBlocked || !installation

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmed || busy || blocked || !installation) return
    setError(null)
    setCreateNotConnected(false)
    try {
      const app = await createApp.mutateAsync({
        name: trimmed,
        studioEnvironmentId,
        installationId: installation.installationId,
        orgId,
      })
      setDone(true)
      router.push(`/user/apps/${app.id}`)
    } catch (err) {
      if (isAppsError(err, 'GITHUB_NOT_CONNECTED')) setCreateNotConnected(true)
      setError(describeCreateStudioAppError(err, org?.name))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Make it an App</DialogTitle>
        <DialogDescription>
          Creates a private GitHub repository in{' '}
          {installation?.accountLogin ?? 'your GitHub account'} for this Studio, with Vetra deploys
          set up: every pull request gets a preview, and merging to main ships to production. It
          also creates the App&apos;s production environment.
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
      {installations.isPending ? (
        <p className="text-muted-foreground text-sm">Checking your GitHub connection…</p>
      ) : notConnected ? (
        <ReconnectGithub message="Your GitHub authorization expired. Reconnect, then create the app again." />
      ) : list.length === 0 ? (
        <ConnectGithub installUrl={info.data?.installUrl} authorizeUrl={info.data?.authorizeUrl} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="make-app-owner">Repository owner</Label>
          <Select value={installation?.installationId ?? ''} onValueChange={setPickedInstallation}>
            <SelectTrigger id="make-app-owner" className="w-full">
              <SelectValue placeholder="Choose an account" />
            </SelectTrigger>
            <SelectContent>
              {list.map((inst) => (
                <SelectItem key={inst.installationId} value={inst.installationId}>
                  {inst.accountLogin}
                  <span className="text-muted-foreground text-xs">
                    {inst.accountType === 'Organization' ? 'org' : 'user'}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {roleBlocked && org && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm">
          Ask an owner or admin of {org.name} to create apps.
        </p>
      )}
      {error && !createNotConnected && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={!trimmed || busy || blocked}>
          {busy ? 'Creating…' : 'Create App'}
        </Button>
      </DialogFooter>
    </form>
  )
}
