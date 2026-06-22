'use client'

import { useState } from 'react'
import { Check, Github } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { myGithubConnection } from './lib/client'
import { ConnectGithubStep } from './connect-github-step'

/**
 * GitHub connection status and connect control for one environment: shows the
 * connected repo or a connect button, and opens the device-flow dialog. Takes
 * only an environmentId, so it can be placed on a product card or elsewhere.
 */
export function GithubConnectionControl({ environmentId }: { environmentId: string }) {
  const [open, setOpen] = useState(false)
  const {
    data: status,
    isLoading,
    refetch,
  } = useAuthedQuery(['github-connection', environmentId], (token) =>
    token ? myGithubConnection(environmentId, token) : Promise.resolve(null),
  )

  const connection = status?.connected ? status.connection : null

  return (
    <div className="flex items-center gap-2 text-sm">
      <Github className="text-muted-foreground h-4 w-4 shrink-0" />
      {isLoading ? (
        <span className="text-muted-foreground">…</span>
      ) : connection ? (
        <a
          href={connection.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-1"
        >
          <Check className="text-primary h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{connection.repoFullName}</span>
        </a>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          Connect GitHub
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect GitHub</DialogTitle>
          </DialogHeader>
          {open ? (
            <ConnectGithubStep
              environmentId={environmentId}
              onDone={() => {
                setOpen(false)
                void refetch()
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
