'use client'

import {
  ArrowLeft,
  ArrowRight,
  Fingerprint,
  GitBranch,
  Github,
  Loader2,
  Lock,
  Rocket,
  Server,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

import { describeAppsError } from '../graphql'
import { useCreateApp, useStandaloneEnvFilter } from '../hooks/use-apps'
import type { App, GithubRepo } from '../types'
import { CopyButton } from './copy-button'
import { RepoPicker } from './repo-picker'
import { SetupDeploys } from './setup-deploys'
import { Stepper } from './stepper'

const STEPS = [
  { id: 'repo', label: 'Repository' },
  { id: 'configure', label: 'Configure' },
  { id: 'identity', label: 'Identity' },
  { id: 'deploys', label: 'Deploys' },
] as const

/** sessionStorage key: the draft survives the round-trip through GitHub. */
export const NEW_APP_DRAFT_KEY = 'vetra-apps:new-app-draft'

type EnvMode = 'new' | 'existing'

type Draft = {
  installationId: string | null
  repo: GithubRepo | null
  name: string
  productionBranch: string
  envMode: EnvMode
  existingEnvId: string
}

const EMPTY_DRAFT: Draft = {
  installationId: null,
  repo: null,
  name: '',
  productionBranch: '',
  envMode: 'new',
  existingEnvId: '',
}

function readDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(NEW_APP_DRAFT_KEY)
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY_DRAFT
  } catch {
    return EMPTY_DRAFT
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(NEW_APP_DRAFT_KEY, JSON.stringify(draft))
    else sessionStorage.removeItem(NEW_APP_DRAFT_KEY)
  } catch {
    /* storage unavailable — the draft just won't survive a reload */
  }
}

/** `org/my-repo` → `my-repo`. */
export function defaultAppName(fullName: string): string {
  return fullName.split('/').pop() ?? fullName
}

function StepCard({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-card border-border rounded-2xl border p-6 shadow-sm sm:p-8">
      <div className="mb-6 space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function RepoChip({ repo, onChange }: { repo: GithubRepo; onChange?: () => void }) {
  return (
    <div className="bg-muted/60 flex items-center gap-3 rounded-lg px-3 py-2">
      <Github className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{repo.fullName}</span>
      {repo.private && <Lock className="text-muted-foreground h-3.5 w-3.5" aria-label="Private" />}
      {onChange && (
        <Button variant="ghost" size="sm" onClick={onChange}>
          Change
        </Button>
      )}
    </div>
  )
}

function ConfigureStep({
  draft,
  update,
  onBack,
  onCreated,
}: {
  draft: Draft & { repo: GithubRepo; installationId: string }
  update: (patch: Partial<Draft>) => void
  onBack: () => void
  onCreated: (app: App) => void
}) {
  const { viewer } = useViewer()
  const { environments, isPending: envsPending } = useEnvironments('MINE', viewer?.address ?? null)
  const { isStandalone } = useStandaloneEnvFilter()
  const standalone = useMemo(
    () => environments.filter((e) => isStandalone(e) && !e.state.studioInstanceId),
    [environments, isStandalone],
  )
  const createApp = useCreateApp()

  const nameError = draft.name.trim() ? null : 'Give your app a name'
  const branchError = draft.productionBranch.trim()
    ? null
    : 'Pick the branch that deploys production'
  const envError =
    draft.envMode === 'existing' && !draft.existingEnvId ? 'Choose an environment' : null
  const invalid = !!(nameError || branchError || envError)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (invalid) return
    createApp.mutate(
      {
        name: draft.name.trim(),
        installationId: draft.installationId,
        repositoryId: draft.repo.id,
        productionBranch: draft.productionBranch.trim(),
        productionEnvironmentId: draft.envMode === 'existing' ? draft.existingEnvId : null,
      },
      {
        onSuccess: (app) => {
          toast.success(`${app.name} created`)
          onCreated(app)
        },
        onError: (err) => toast.error(describeAppsError(err)),
      },
    )
  }

  return (
    <StepCard
      title="Configure your app"
      description="Production follows one branch. Pull requests get their own previews."
    >
      <form onSubmit={submit} className="space-y-6" noValidate>
        <RepoChip repo={draft.repo} onChange={onBack} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="app-name">App name</Label>
            <Input
              id="app-name"
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              aria-invalid={!!nameError}
              maxLength={64}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-branch">Production branch</Label>
            <div className="relative">
              <GitBranch
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                id="app-branch"
                value={draft.productionBranch}
                onChange={(e) => update({ productionBranch: e.target.value })}
                aria-invalid={!!branchError}
                className="pl-9 font-mono"
              />
            </div>
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-3 text-sm font-medium">Production environment</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  mode: 'new' as const,
                  icon: Rocket,
                  title: 'Create a new environment',
                  body: 'Fresh Connect + Switchboard on vetra.io. Recommended.',
                },
                {
                  mode: 'existing' as const,
                  icon: Server,
                  title: 'Use an existing environment',
                  body: standalone.length
                    ? 'Attach one of your standalone environments.'
                    : 'You have no standalone environment to attach.',
                },
              ] as const
            ).map((opt) => {
              const disabled = opt.mode === 'existing' && !envsPending && standalone.length === 0
              const checked = draft.envMode === opt.mode
              return (
                <label
                  key={opt.mode}
                  className={cn(
                    'border-border relative flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                    checked
                      ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
                      : 'hover:bg-accent/50',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input
                    type="radio"
                    name="env-mode"
                    value={opt.mode}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => update({ envMode: opt.mode })}
                    className="sr-only"
                  />
                  <opt.icon
                    className={cn(
                      'mt-0.5 h-5 w-5 shrink-0',
                      checked ? 'text-primary' : 'text-muted-foreground',
                    )}
                    aria-hidden
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{opt.title}</span>
                    <span className="text-muted-foreground block text-xs">{opt.body}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {draft.envMode === 'existing' && (
            <Select value={draft.existingEnvId} onValueChange={(v) => update({ existingEnvId: v })}>
              <SelectTrigger className="w-full" aria-label="Existing environment">
                <SelectValue placeholder={envsPending ? 'Loading…' : 'Choose an environment'} />
              </SelectTrigger>
              <SelectContent>
                {standalone.map((env) => (
                  <SelectItem key={env.id} value={env.id}>
                    {env.state.label || env.name}
                    {env.state.genericSubdomain && (
                      <span className="text-muted-foreground font-mono text-xs">
                        {env.state.genericSubdomain}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </fieldset>

        <div className="border-border flex items-center justify-between gap-3 border-t pt-6">
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button type="submit" disabled={invalid || createApp.isPending}>
            {createApp.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            {createApp.isPending ? 'Creating…' : 'Create app'}
          </Button>
        </div>
      </form>
    </StepCard>
  )
}

function IdentityStep({ app, onSkip }: { app: App; onSkip: () => void }) {
  return (
    <StepCard
      title="Authorize the deploy identity"
      description="One signature, once. It lets GitHub Actions deploy this app on your behalf."
    >
      <div className="space-y-6">
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Fingerprint, text: 'Your app gets its own Renown identity.' },
            { icon: Github, text: `Only workflows in ${app.repository.fullName} can use it.` },
            { icon: ShieldCheck, text: 'Pull requests can never touch production.' },
          ].map((item) => (
            <li key={item.text} className="bg-muted/50 flex gap-3 rounded-xl p-4 text-sm">
              <item.icon className="text-primary h-4 w-4 shrink-0" aria-hidden />
              {item.text}
            </li>
          ))}
        </ul>

        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            App identity
          </p>
          <div className="bg-muted/60 flex items-center gap-2 rounded-lg py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{app.identityDid}</code>
            <CopyButton value={app.identityDid} label="Copy identity" />
          </div>
        </div>

        <div className="border-border flex flex-col-reverse items-stretch justify-between gap-3 border-t pt-6 sm:flex-row sm:items-center">
          <Button variant="ghost" onClick={onSkip}>
            Do this later
          </Button>
          <Button onClick={() => window.location.assign(app.renownAuthorizeUrl)} size="lg">
            <Fingerprint className="h-4 w-4" />
            Authorize on Renown
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </StepCard>
  )
}

function DeploysStep({ app }: { app: App }) {
  return (
    <StepCard
      title="Set up deploys"
      description={
        <>
          Add the Vetra workflow to{' '}
          <span className="text-foreground">{app.repository.fullName}</span>. Pushes to{' '}
          <span className="text-foreground font-mono">{app.productionBranch}</span> deploy
          production; pull requests get previews.
        </>
      }
    >
      <div className="space-y-6">
        {app.status === 'PENDING_IDENTITY' && (
          <p className="bg-warning/10 text-foreground rounded-lg px-4 py-3 text-sm">
            Deploys start working once the app identity is authorized. You can do that from the app
            page any time.
          </p>
        )}
        <SetupDeploys app={app} />
        <div className="border-border flex justify-end border-t pt-6">
          <Button asChild>
            <Link href={`/user/apps/${app.id}`}>
              Go to {app.name}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </StepCard>
  )
}

/** `/user/apps/new` — connect repo → configure → authorize identity → set up deploys. */
export function NewAppWizard() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [step, setStep] = useState(0)
  const [app, setApp] = useState<App | null>(null)

  // Restore the draft after the GitHub install/authorize round-trip. Read on
  // mount (sessionStorage is unavailable during SSR).
  useEffect(() => {
    const saved = readDraft()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe restore from sessionStorage
    setDraft(saved)
    if (saved.repo && saved.installationId) setStep(1)
  }, [])

  const update = (patch: Partial<Draft>) =>
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      writeDraft(next)
      return next
    })

  const pickRepo = (repo: GithubRepo, installationId: string) => {
    const sameRepo = draft.repo?.id === repo.id
    update({
      repo,
      installationId,
      name: sameRepo && draft.name ? draft.name : defaultAppName(repo.fullName),
      productionBranch:
        sameRepo && draft.productionBranch ? draft.productionBranch : repo.defaultBranch,
    })
    setStep(1)
  }

  const onCreated = (created: App) => {
    writeDraft(null)
    setApp(created)
    setStep(created.status === 'PENDING_IDENTITY' ? 2 : 3)
  }

  return (
    <main className="mx-auto mt-20 max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <div className="space-y-4">
        <Link
          href="/user"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Apps
        </Link>
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight">Create an app</h1>
          <p className="text-muted-foreground">
            Connect a GitHub repository. Every push to production and every pull request deploys
            automatically.
          </p>
        </div>
        <Stepper steps={STEPS} current={step} />
      </div>

      {step === 0 && (
        <StepCard
          title="Import a GitHub repository"
          description="Pick the repository with your Powerhouse packages or front-end."
        >
          <RepoPicker
            installationId={draft.installationId}
            onInstallationChange={(installationId) => update({ installationId })}
            onPick={pickRepo}
          />
        </StepCard>
      )}

      {step === 1 && draft.repo && draft.installationId && (
        <ConfigureStep
          draft={{ ...draft, repo: draft.repo, installationId: draft.installationId }}
          update={update}
          onBack={() => setStep(0)}
          onCreated={onCreated}
        />
      )}

      {step === 2 && app && <IdentityStep app={app} onSkip={() => setStep(3)} />}
      {step === 3 && app && <DeploysStep app={app} />}
    </main>
  )
}
