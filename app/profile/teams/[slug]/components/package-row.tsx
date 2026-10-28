'use client'
import { Github, Loader2, Package as PackageIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { usePHToast } from '@powerhousedao/reactor-browser'
import { Button } from '@/modules/shared/components/ui/button'
import { useTeamSpaces } from '@/modules/profile/lib/use-team-spaces'
import type { FullTeam, FullTeamPackage } from '@/modules/profile/lib/create-team-queries'
import { ConfirmDialog } from './confirm-dialog'

function NpmIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M2 22V2h20v20h-10V7H7v15H2z" />
    </svg>
  )
}

export function PackageRow({ team, pkg }: { team: FullTeam; pkg: FullTeamPackage }) {
  const { updatePackage, deletePackage, isPending } = useTeamSpaces(team)
  const toast = usePHToast()
  const [title, setTitle] = useState(pkg.name)
  const [description, setDescription] = useState(pkg.description ?? '')
  const [github, setGithub] = useState(pkg.githubUrl ?? '')
  const [npm, setNpm] = useState(pkg.npmUrl ?? '')
  const [savingField, setSavingField] = useState<string | null>(null)
  const [savedField, setSavedField] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveIfChanged = async (
    field: 'title' | 'description' | 'github' | 'npm',
    value: string,
    original: string | null,
  ) => {
    if (value === (original ?? '')) return
    setSavingField(field)
    try {
      await updatePackage({ id: pkg.id, [field]: value })
      setSavedField(field)
      setTimeout(() => setSavedField((cur) => (cur === field ? null : cur)), 1500)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      toast?.(`Couldn't save — ${msg}`, { type: 'error' })
    } finally {
      setSavingField((cur) => (cur === field ? null : cur))
    }
  }

  const doDelete = async () => {
    setConfirmDelete(false)
    try {
      await deletePackage(pkg.id)
      toast?.('Package removed', { type: 'success' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      toast?.(`Couldn't delete — ${msg}`, { type: 'error' })
    }
  }

  return (
    <div className="border-border/60 rounded-md border p-4">
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1">
          <FieldLabel>Title</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              className="bg-background focus:ring-primary w-full rounded-md border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void saveIfChanged('title', title, pkg.name)}
            />
            <StatusChip saving={savingField === 'title'} saved={savedField === 'title'} />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete package"
          onClick={() => setConfirmDelete(true)}
          disabled={isPending}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mb-3">
        <FieldLabel>Description</FieldLabel>
        <div className="flex items-start gap-2">
          <textarea
            rows={2}
            className="bg-background focus:ring-primary w-full rounded-md border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => void saveIfChanged('description', description, pkg.description)}
          />
          <StatusChip saving={savingField === 'description'} saved={savedField === 'description'} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>
            <Github className="size-3.5" /> GitHub
          </FieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="url"
              className="bg-background focus:ring-primary w-full rounded-md border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
              placeholder="https://github.com/…"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              onBlur={() => void saveIfChanged('github', github, pkg.githubUrl)}
            />
            <StatusChip saving={savingField === 'github'} saved={savedField === 'github'} />
          </div>
        </div>
        <div>
          <FieldLabel>
            <NpmIcon className="size-3.5" /> npm
          </FieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="url"
              className="bg-background focus:ring-primary w-full rounded-md border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
              placeholder="https://www.npmjs.com/package/…"
              value={npm}
              onChange={(e) => setNpm(e.target.value)}
              onBlur={() => void saveIfChanged('npm', npm, pkg.npmUrl)}
            />
            <StatusChip saving={savingField === 'npm'} saved={savedField === 'npm'} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete package?"
        description={`This removes "${title || 'Untitled package'}" from the space.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
      <PackageIconHidden />
      {children}
    </label>
  )
}

function PackageIconHidden() {
  return <PackageIcon className="hidden" />
}

function StatusChip({ saving, saved }: { saving: boolean; saved: boolean }) {
  if (saving) return <Loader2 className="text-muted-foreground size-4 animate-spin" />
  if (saved)
    return <span className="text-success dark:text-success text-xs font-medium">Saved</span>
  return <span className="size-4" />
}
