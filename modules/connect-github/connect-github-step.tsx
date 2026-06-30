'use client'

import { useState } from 'react'
import { Check, Github, Loader2 } from 'lucide-react'
import { AsyncButton } from '@/modules/cloud/components/async-button'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import { githubInstallUrl } from './lib/client'
import { useConnectGithub } from './use-connect-github'

/** GitHub connect step: name a repository and authorize it via the device flow. */
export function ConnectGithubStep({
  environmentId,
  onDone,
}: {
  environmentId: string
  onDone: () => void
}) {
  const { phase, connect } = useConnectGithub(environmentId)
  const [repoName, setRepoName] = useState('')

  if (phase.kind === 'connected') {
    const installUrl = githubInstallUrl()
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Check className="text-primary h-4 w-4" />
          Repository created
        </div>
        <p className="text-muted-foreground text-sm">
          The agent will push to{' '}
          <a
            href={phase.connection.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline"
          >
            {phase.connection.repoFullName}
          </a>{' '}
          once the Vetra app is installed on it. You can install it now or when you want to deploy.
        </p>
        {installUrl ? (
          <a
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors"
          >
            <Github className="mr-2 h-4 w-4" />
            Install the Vetra app
          </a>
        ) : null}
        <Button onClick={() => onDone()}>Continue</Button>
      </div>
    )
  }

  if (phase.kind === 'starting') {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Starting…
      </div>
    )
  }

  if (phase.kind === 'awaiting') {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Open GitHub and enter this code to authorize Vetra:
        </p>
        <div className="bg-muted rounded-lg px-4 py-3 text-center font-mono text-lg tracking-[0.3em]">
          {phase.userCode}
        </div>
        <a
          href={phase.verificationUri}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors"
        >
          <Github className="mr-2 h-4 w-4" />
          Open GitHub
        </a>
        {phase.installUrl ? (
          <p className="text-muted-foreground text-sm">
            The Vetra app is not installed on your account yet —{' '}
            <a
              href={phase.installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline"
            >
              install it
            </a>
            , then leave this open.
          </p>
        ) : null}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for authorization…
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Vetra creates a private repository in your GitHub account and pushes everything this studio
        generates to it. Pick a name (must be unique in your account).
      </p>
      <div className="space-y-2">
        <Label htmlFor="repo-name">Repository name</Label>
        <Input
          id="repo-name"
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          placeholder="my-vetra-studio"
          autoComplete="off"
        />
      </div>
      {phase.kind === 'error' ? <p className="text-destructive text-sm">{phase.message}</p> : null}
      <AsyncButton
        onClickAsync={async () => {
          const name = repoName.trim()
          if (!name) throw new Error('A repository name is required')
          await connect(name)
        }}
        disabled={!repoName.trim()}
      >
        Connect GitHub
      </AsyncButton>
    </div>
  )
}
