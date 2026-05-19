'use client'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { usePHToast } from '@powerhousedao/reactor-browser'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'
import { useTeamSpaces } from '@/modules/profile/lib/use-team-spaces'
import type { FullTeam, FullTeamSpace } from '@/modules/profile/lib/create-team-queries'
import { PackageRow } from './package-row'
import { ConfirmDialog } from './confirm-dialog'

export function SpaceCard({ team, space }: { team: FullTeam; space: FullTeamSpace }) {
  const { updateSpace, deleteSpace, createPackage, isPending } = useTeamSpaces(team)
  const toast = usePHToast()
  const [title, setTitle] = useState(space.title)
  const [description, setDescription] = useState(space.description ?? '')
  const [savingField, setSavingField] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveIfChanged = async (
    field: 'title' | 'description',
    value: string,
    original: string | null,
  ) => {
    if (value === (original ?? '')) return
    setSavingField(field)
    try {
      await updateSpace({ id: space.id, [field]: value })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      toast?.(`Couldn't save — ${msg}`, { type: 'error' })
    } finally {
      setSavingField(null)
    }
  }

  const doDelete = async () => {
    setConfirmDelete(false)
    try {
      await deleteSpace(space.id)
      toast?.('Space removed', { type: 'success' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      toast?.(`Couldn't delete — ${msg}`, { type: 'error' })
    }
  }

  const doAddPackage = async () => {
    try {
      await createPackage(space.id)
      toast?.('Package added', { type: 'success' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      toast?.(`Couldn't add package — ${msg}`, { type: 'error' })
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-3">
            <div>
              <input
                className="bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-base font-semibold focus:ring-2 focus:outline-none"
                placeholder="Space title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void saveIfChanged('title', title, space.title)}
              />
            </div>
            <div>
              <textarea
                rows={2}
                placeholder="Optional description…"
                className="bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => void saveIfChanged('description', description, space.description)}
              />
            </div>
            {savingField && (
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <Loader2 className="size-3 animate-spin" />
                Saving {savingField}…
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete space"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="space-y-3 border-t pt-5">
          {space.packages.length === 0 && (
            <p className="text-muted-foreground text-sm">No packages in this space yet.</p>
          )}
          {space.packages.map((p) => (
            <PackageRow key={p.id} team={team} pkg={p} />
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void doAddPackage()}
            disabled={isPending}
          >
            <Plus className="mr-1.5 size-3.5" />
            Add package
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete space?"
        description={`This removes "${title || 'Untitled space'}" and all packages inside it.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Card>
  )
}
