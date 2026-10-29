'use client'

import { useMemo } from 'react'

import {
  buildEnvTopology,
  type TopologyNode,
  type TopologyTone,
} from '@/modules/cloud/lib/env-topology'
import type { CloudEnvironmentService, CloudPackage } from '@/modules/cloud/types'
import { cn } from '@/shared/lib/utils'

const TONE_FILL: Record<TopologyTone, string> = {
  success: 'fill-success',
  warning: 'fill-warning',
  info: 'fill-info',
  destructive: 'fill-destructive',
  muted: 'fill-muted-foreground',
}

// Characters that fit inside a box: monospace packages at 11px, labels at 13px.
const PACKAGE_LABEL_MAX = 34
const NODE_LABEL_MAX = 20
const HUB_LABEL_MAX = 28

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

type ServiceDetailKind = 'connect' | 'switchboard' | 'fusion'

type EnvTopologyProps = {
  services: readonly CloudEnvironmentService[]
  packages: readonly CloudPackage[]
  /** Same handlers the service rows / agent cards use to open their drawers. */
  onOpenServiceDetail?: (kind: ServiceDetailKind) => void
  onOpenAgentDetail?: (prefix: string) => void
}

/**
 * Map of how the environment's parts connect: clients → Switchboard (with
 * its packages, which share one reactor) → database. Inline SVG; scales to
 * the card and scrolls sideways inside its own box on narrow screens.
 */
export function EnvTopology({
  services,
  packages,
  onOpenServiceDetail,
  onOpenAgentDetail,
}: EnvTopologyProps) {
  const topology = useMemo(() => buildEnvTopology({ services, packages }), [services, packages])

  if (topology.nodes.length === 0) {
    return <p className="text-muted-foreground text-sm">No services enabled yet.</p>
  }

  const openHandler = (node: TopologyNode): (() => void) | undefined => {
    if (node.kind === 'agent') {
      return onOpenAgentDetail && node.prefix ? () => onOpenAgentDetail(node.prefix!) : undefined
    }
    if (node.kind === 'database') return undefined
    return onOpenServiceDetail
      ? () => onOpenServiceDetail(node.kind as ServiceDetailKind)
      : undefined
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${topology.width} ${topology.height}`}
        width={topology.width}
        className="mx-auto block h-auto max-w-none sm:max-w-full"
        role="group"
        aria-label="Environment topology"
      >
        <g className="stroke-border" fill="none" strokeWidth={1.5}>
          {topology.edges.map((e) => {
            const mid = (e.x1 + e.x2) / 2
            // Horizontal edges bend as an S-curve; the vertical one is straight.
            const d =
              e.x1 === e.x2
                ? `M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`
                : `M ${e.x1} ${e.y1} C ${mid} ${e.y1}, ${mid} ${e.y2}, ${e.x2} ${e.y2}`
            return <path key={`${e.from}->${e.to}`} d={d} />
          })}
        </g>
        {topology.nodes.map((node) => {
          const onOpen = openHandler(node)
          const isHub = node.kind === 'switchboard'
          return (
            <g
              key={node.id}
              data-testid={`topology-node-${node.id}`}
              className={cn(onOpen && 'group cursor-pointer focus:outline-none')}
              role={onOpen ? 'button' : undefined}
              tabIndex={onOpen ? 0 : undefined}
              aria-label={onOpen ? `Open ${node.label} details` : undefined}
              onClick={onOpen}
              onKeyDown={
                onOpen
                  ? (ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault()
                        onOpen()
                      }
                    }
                  : undefined
              }
            >
              <title>{node.label}</title>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={node.kind === 'database' ? 12 : 6}
                className={cn(
                  'fill-card stroke-border',
                  onOpen && 'group-hover:stroke-primary group-focus-visible:stroke-primary',
                )}
                strokeWidth={1}
              />
              <circle
                cx={node.x + 14}
                cy={node.y + (isHub ? 20 : node.height / 2)}
                r={4}
                className={TONE_FILL[node.tone]}
              />
              <text
                x={node.x + 26}
                y={node.y + (isHub ? 20 : node.height / 2)}
                dominantBaseline="central"
                className="fill-foreground text-[13px] font-medium"
              >
                {truncate(node.label, isHub ? HUB_LABEL_MAX : NODE_LABEL_MAX)}
              </text>
            </g>
          )
        })}
        {topology.packages.map((p) => {
          const full = p.version ? `${p.name}@${p.version}` : p.name
          return (
            <g key={p.name}>
              <title>{full}</title>
              <text
                x={p.x}
                y={p.y + 10}
                dominantBaseline="central"
                className="fill-muted-foreground font-mono text-[11px]"
              >
                {truncate(full, PACKAGE_LABEL_MAX)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** List / Map switch for the Services card header. */
export function ServicesViewToggle({
  value,
  onChange,
}: {
  value: 'list' | 'map'
  onChange: (value: 'list' | 'map') => void
}) {
  return (
    <div
      className="border-border inline-flex rounded-md border p-0.5"
      role="group"
      aria-label="Services view"
    >
      {(['list', 'map'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'rounded px-2 py-0.5 text-xs capitalize transition-colors',
            value === v
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
