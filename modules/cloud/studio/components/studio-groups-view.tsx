'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { CloudLanding } from '@/modules/cloud/components/cloud-landing'
import { CloudEnvironmentCard } from '@/app/user/environments/cloud-projects'
import { StudioBootScreen } from './studio-boot-screen'
import { NewProductCard } from './new-product-card'
import { StudioGroup } from './studio-group'
import { useStudioGroups } from '../use-studio-groups'

/** Placeholder group shown during the very first load (no cached data yet). */
function GroupSkeleton() {
  return (
    <div className="border-border rounded-2xl border p-4">
      <div className="bg-muted/40 border-border flex items-center gap-3 rounded-xl border px-4 py-4">
        <div className="bg-muted h-11 w-11 shrink-0 animate-pulse rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="bg-muted h-4 w-1/3 animate-pulse rounded" />
          <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-muted/40 h-40 animate-pulse rounded-xl" />
        <div className="bg-muted/40 h-40 animate-pulse rounded-xl" />
      </div>
    </div>
  )
}

/**
 * The grouped `/user/products` layout: one collapsible group per studio (its
 * managed header + the environments it deployed to), then a header-less "Other
 * environments" section for envs not tied to any studio, then top-level create
 * actions. Wired to real data via `useStudioGroups`.
 */
export function StudioGroupsView() {
  const {
    gate,
    groups,
    standalone,
    isScanning,
    limit,
    atLimit,
    creating,
    createError,
    createProduct,
    hasAttachedKey,
  } = useStudioGroups()

  if (gate === 'unauthenticated') return <CloudLanding />
  if (gate === 'loading') return <StudioBootScreen title="Loading…" />

  const handleCreate = async (apiKey?: string) => {
    await createProduct(apiKey)
  }

  const nothingYet = groups.length === 0 && standalone.length === 0
  const showSkeletons = isScanning && nothingYet
  const showEmptyState = !isScanning && nothingYet && !creating

  return (
    <div className="mx-auto mt-24 max-w-screen-xl px-6 pb-16">
      <h1 className="mb-6 text-2xl font-semibold">Environments</h1>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-lg font-medium">No studios yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Create your first Vetra Studio to build a product and deploy it to environments.
          </p>
          <NewProductCard
            onCreate={handleCreate}
            createError={createError}
            hasAttachedKey={hasAttachedKey}
            variant="button"
          />
        </div>
      ) : showSkeletons ? (
        <div className="space-y-6">
          <GroupSkeleton />
          <GroupSkeleton />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <StudioGroup key={group.studio.envId} group={group} />
          ))}

          {standalone.length > 0 && (
            <div className="border-border rounded-2xl border p-4">
              <p className="text-muted-foreground mb-3 px-1 text-xs font-medium tracking-wide uppercase">
                Other environments
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {standalone.map((env) => (
                  <CloudEnvironmentCard key={env.id} env={env} />
                ))}
              </div>
            </div>
          )}

          {/* Top-level create actions: a new environment, or a whole new studio. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/user/environments/new"
              className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex items-center justify-center gap-2 rounded-2xl border border-dashed py-5 text-sm font-medium transition-colors"
            >
              <Plus className="h-5 w-5" />
              New environment…
            </Link>
            <NewProductCard
              onCreate={handleCreate}
              createError={createError}
              hasAttachedKey={hasAttachedKey}
              variant="row"
              atLimit={atLimit}
              limit={limit}
            />
          </div>
        </div>
      )}
    </div>
  )
}
