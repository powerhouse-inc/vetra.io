'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { StudioGroupHeader } from './studio-group-header'
import { OwnedEnvCard } from './owned-env-card'
import type { MockStudioGroup } from './mock-data'

/**
 * IDEATION ONLY — one product development cycle: a managed Studio header with
 * its environments organized underneath. The environments collapse behind the
 * header's caret so the standalone "Other environments" section stands out when
 * the Studio groups are folded away.
 */
export function StudioGroup({ group }: { group: MockStudioGroup }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="border-border rounded-2xl border p-4">
      <StudioGroupHeader
        studio={group.studio}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      {!collapsed && (
        <div className="mt-4 px-1">
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
            Environments
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.environments.map((env) => (
              <OwnedEnvCard key={env.id} env={env} />
            ))}

            {/* Create a new environment under this Studio. */}
            <button className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-colors">
              <Plus className="h-6 w-6" />
              <span className="text-sm">New environment…</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
