'use client'

import { ArrowRight, Github, Globe, Loader2, Lock, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/modules/shared/components/ui/alert'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'

import { describeAppsError, isAppsError } from '../graphql'
import {
  useGithubDeployAppInfo,
  useGithubDeployRepositories,
  useMyGithubDeployInstallations,
} from '../hooks/use-apps'
import type { GithubDeployInstallation, GithubRepo } from '../types'
import { GithubFlowLink } from './github-flow-link'
import { ReconnectGithub } from './reconnect-github'

/** Case-insensitive substring match on the repo's full name. Exported for tests. */
export function filterRepos(repos: readonly GithubRepo[], query: string): GithubRepo[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...repos]
  return repos.filter((r) => r.fullName.toLowerCase().includes(q))
}

function ConnectGithub({
  installUrl,
  authorizeUrl,
}: {
  installUrl?: string
  authorizeUrl?: string
}) {
  return (
    <div className="border-border flex flex-col items-center gap-5 rounded-xl border border-dashed px-6 py-10 text-center">
      <span className="bg-foreground text-background flex h-12 w-12 items-center justify-center rounded-2xl">
        <Github className="h-6 w-6" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <p className="text-lg font-semibold">Connect GitHub</p>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">
          Install the <span className="text-foreground font-medium">Vetra Deploy</span> GitHub App
          on the account or organization that owns your repository. You choose which repositories it
          can see.
        </p>
      </div>
      <Button asChild size="lg" disabled={!installUrl}>
        <GithubFlowLink url={installUrl}>
          <Github className="h-4 w-4" />
          Install Vetra Deploy
        </GithubFlowLink>
      </Button>
      {authorizeUrl && (
        <p className="text-muted-foreground text-sm">
          Already installed?{' '}
          <GithubFlowLink url={authorizeUrl} className="text-primary font-medium hover:underline">
            Authorize your GitHub account
          </GithubFlowLink>
        </p>
      )}
    </div>
  )
}

function InstallationSelect({
  installations,
  value,
  onChange,
}: {
  installations: GithubDeployInstallation[]
  value: string
  onChange: (id: string) => void
}) {
  if (installations.length === 1) {
    const only = installations[0]
    return (
      <span className="bg-muted inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium">
        <Github className="h-4 w-4" aria-hidden />
        {only.accountLogin}
      </span>
    )
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56" aria-label="GitHub account">
        <SelectValue placeholder="Choose an account" />
      </SelectTrigger>
      <SelectContent>
        {installations.map((inst) => (
          <SelectItem key={inst.installationId} value={inst.installationId}>
            <Github className="h-4 w-4" aria-hidden />
            {inst.accountLogin}
            <span className="text-muted-foreground text-xs">
              {inst.accountType === 'Organization' ? 'org' : 'user'}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RepoList({
  installationId,
  onPick,
}: {
  installationId: string
  onPick: (repo: GithubRepo) => void
}) {
  const [query, setQuery] = useState('')
  const repos = useGithubDeployRepositories(installationId)
  const visible = useMemo(() => filterRepos(repos.data ?? [], query), [repos.data, query])

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <div className="border-border relative border-b">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repositories…"
          aria-label="Search repositories"
          className="h-11 rounded-none border-0 pl-9 shadow-none focus-visible:ring-0"
        />
      </div>
      {repos.isPending ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading repositories…
        </div>
      ) : isAppsError(repos.error, 'GITHUB_NOT_CONNECTED') ? (
        <ReconnectGithub className="m-4" />
      ) : repos.error ? (
        <p className="text-destructive px-4 py-8 text-center text-sm">
          {describeAppsError(repos.error)}
        </p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          {query ? `No repository matches “${query}”.` : 'Vetra Deploy cannot see any repository.'}
        </p>
      ) : (
        <ul className="divide-border max-h-96 divide-y overflow-y-auto" aria-label="Repositories">
          {visible.map((repo) => (
            <li key={repo.id}>
              <button
                type="button"
                onClick={() => onPick(repo)}
                className="group hover:bg-accent/60 focus-visible:bg-accent flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none"
              >
                {repo.private ? (
                  <Lock className="text-muted-foreground h-4 w-4 shrink-0" aria-label="Private" />
                ) : (
                  <Globe className="text-muted-foreground h-4 w-4 shrink-0" aria-label="Public" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{repo.fullName}</span>
                <span className="text-muted-foreground hidden font-mono text-xs sm:inline">
                  {repo.defaultBranch}
                </span>
                <span className="text-primary inline-flex items-center gap-1 text-sm font-medium opacity-70 transition-opacity group-hover:opacity-100">
                  Import
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Step 1 of the new-app flow: GitHub connection, account and repository. */
export function RepoPicker({
  installationId,
  onInstallationChange,
  onPick,
}: {
  installationId: string | null
  onInstallationChange: (id: string) => void
  onPick: (repo: GithubRepo, installationId: string) => void
}) {
  const info = useGithubDeployAppInfo()
  const installations = useMyGithubDeployInstallations()
  const list = installations.data ?? []
  const effectiveId =
    installationId && list.some((i) => i.installationId === installationId)
      ? installationId
      : (list[0]?.installationId ?? null)

  if (installations.isPending) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Checking your GitHub connection…
      </div>
    )
  }

  if (isAppsError(installations.error, 'GITHUB_NOT_CONNECTED')) {
    return <ReconnectGithub />
  }

  if (installations.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load your GitHub connection</AlertTitle>
        <AlertDescription>{describeAppsError(installations.error)}</AlertDescription>
      </Alert>
    )
  }

  if (list.length === 0) {
    return (
      <ConnectGithub installUrl={info.data?.installUrl} authorizeUrl={info.data?.authorizeUrl} />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InstallationSelect
          installations={list}
          value={effectiveId ?? ''}
          onChange={onInstallationChange}
        />
        {info.data?.installUrl && (
          <GithubFlowLink
            url={info.data.installUrl}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add account or repositories
          </GithubFlowLink>
        )}
      </div>
      {effectiveId && (
        <RepoList installationId={effectiveId} onPick={(repo) => onPick(repo, effectiveId)} />
      )}
    </div>
  )
}
