import { Plus } from 'lucide-react'
import { StudioGroup } from './studio-group'
import { OwnedEnvCard } from './owned-env-card'
import { MOCK_GROUPS, MOCK_STANDALONE_ENVS } from './mock-data'

/**
 * IDEATION ONLY — composes the new header-based layout from mock data.
 *
 * The page lists one collapsible group per product development cycle:
 *
 *   [ full-width Studio header (managed, clickable, collapsible) ]
 *     └─ nested grid of owned environments + "new environment" tile
 *
 * …followed by a header-less "Other environments" section for standalone envs.
 * Mounted at /user/products/preview so it can be reviewed alongside the live
 * products page without touching it.
 */
export function StudioGroupPreview() {
  return (
    <div className="mx-auto mt-24 max-w-screen-xl px-6 pb-16">
      <h1 className="mb-6 text-2xl font-semibold">Environments</h1>

      <div className="space-y-6">
        {MOCK_GROUPS.map((group) => (
          <StudioGroup key={group.studio.id} group={group} />
        ))}

        {/* Environments the user created directly, not tied to any Studio. No
            managed header — just an ungrouped grid of owned environments. */}
        <div className="border-border rounded-2xl border p-4">
          <p className="text-muted-foreground mb-3 px-1 text-xs font-medium tracking-wide uppercase">
            Other environments
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {MOCK_STANDALONE_ENVS.map((env) => (
              <OwnedEnvCard key={env.id} env={env} />
            ))}
          </div>
        </div>

        {/* Top-level create actions: a new environment, or a whole new Studio
            (a new product development cycle). */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex items-center justify-center gap-2 rounded-2xl border border-dashed py-5 text-sm font-medium transition-colors">
            <Plus className="h-5 w-5" />
            New environment…
          </button>
          <button className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex items-center justify-center gap-2 rounded-2xl border border-dashed py-5 text-sm font-medium transition-colors">
            <Plus className="h-5 w-5" />
            New Vetra Studio…
          </button>
        </div>
      </div>

      <p className="text-muted-foreground mt-6 text-center text-xs">
        UI ideation · mock data · not wired to a backend
      </p>
    </div>
  )
}
