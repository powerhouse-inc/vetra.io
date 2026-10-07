'use client'

import { useState } from 'react'
import { routeEnvVars } from '@/modules/cloud/config/route-env-vars'
import { EnvVarsEditor } from '@/modules/cloud/components/env-vars-editor'
import type { CloudFusionConfig, CloudServiceEnv } from '@/modules/cloud/types'
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
import { Switch } from '@/modules/shared/components/ui/switch'

const IMAGE_RE = /^cr\.vetra\.io\/[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)+$/

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: CloudFusionConfig | null | undefined
  /**
   * Called with the document config (secret values stripped) and the secrets
   * the user typed, which the caller writes to the tenant secrets store.
   */
  onSubmit: (
    config: CloudFusionConfig,
    secrets: Array<{ name: string; value: string }>,
  ) => Promise<void>
}

/**
 * FUSION app settings: the image repository (the version picker chooses the
 * tag), runtime env (NEXT_PUBLIC_* are swapped into the bundle at start;
 * secrets stay server-side) and auto-deploy of new image tags.
 */
export function FusionConfigDialog({ open, onOpenChange, config, onSubmit }: Props) {
  const [image, setImage] = useState(config?.image ?? '')
  const [env, setEnv] = useState<CloudServiceEnv[]>(config?.env ?? [])
  const [autoUpdate, setAutoUpdate] = useState(config?.autoUpdate ?? true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const repo = image.trim()
    if (!IMAGE_RE.test(repo)) {
      setError(
        'Image must be a repository on cr.vetra.io without a tag, e.g. cr.vetra.io/<project>/<app>',
      )
      return
    }
    const badSecret = env.find((e) => e.isSecret && e.name.trim().startsWith('NEXT_PUBLIC_'))
    if (badSecret) {
      setError(`${badSecret.name} cannot be a secret: NEXT_PUBLIC_ values end up in browser code`)
      return
    }
    setError(null)
    const { secretsToPersist, envForDocument } = routeEnvVars(env)
    setSaving(true)
    try {
      await onSubmit(
        {
          image: repo,
          env: envForDocument,
          autoUpdate,
          autoUpdateTagPattern: config?.autoUpdateTagPattern ?? null,
        },
        secretsToPersist,
      )
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the Fusion configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fusion app</DialogTitle>
          <DialogDescription>
            Runs your Next.js front-end image next to this environment. The platform sets
            NEXT_PUBLIC_SWITCHBOARD_URL, NEXT_PUBLIC_CONNECT_URL, NEXT_PUBLIC_RENOWN_URL and
            NEXT_PUBLIC_BASE_URL for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fusion-image">Image</Label>
            <Input
              id="fusion-image"
              placeholder="cr.vetra.io/<project>/<app>"
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Environment variables</Label>
            <EnvVarsEditor value={env} onChange={setEnv} disabled={saving} />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="fusion-auto-update">Auto-deploy new images</Label>
              <p className="text-muted-foreground text-xs">
                Deploys the newest <code>sha-*</code> tag pushed for this image.
              </p>
            </div>
            <Switch
              id="fusion-auto-update"
              aria-label="Auto-deploy new images"
              checked={autoUpdate}
              onCheckedChange={setAutoUpdate}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
