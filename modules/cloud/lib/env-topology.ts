import { serviceInstanceKey, serviceInstanceLabel } from './service-label'
import type { CloudEnvironmentService, CloudPackage } from '../types'

/**
 * Pure layout for the environment topology map on the overview tab.
 *
 * Shape: clients (Connect, Fusion, agents) in a left column, each with an
 * edge into Switchboard. Installed packages are drawn inside the Switchboard
 * box — they all load into its one reactor — and the database hangs below.
 * Everything is in viewBox units; the component scales the SVG.
 */

/** Colour bucket for a node, matching the overview StatusDot mapping. */
export type TopologyTone = 'success' | 'warning' | 'info' | 'destructive' | 'muted'

export type TopologyNodeKind = 'connect' | 'fusion' | 'agent' | 'switchboard' | 'database'

export type TopologyNode = {
  id: string
  kind: TopologyNodeKind
  label: string
  tone: TopologyTone
  /** Service prefix (agents use it to open their detail drawer). */
  prefix: string | null
  x: number
  y: number
  width: number
  height: number
}

export type TopologyPackage = {
  name: string
  version: string | null
  x: number
  y: number
}

export type TopologyEdge = {
  from: string
  to: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type EnvTopology = {
  nodes: TopologyNode[]
  /** Package rows, positioned inside the Switchboard node. */
  packages: TopologyPackage[]
  edges: TopologyEdge[]
  width: number
  height: number
}

export const TOPOLOGY_LAYOUT = {
  padding: 8,
  nodeWidth: 180,
  nodeHeight: 40,
  nodeGap: 14,
  columnGap: 72,
  hubWidth: 240,
  hubHeaderHeight: 40,
  packageRowHeight: 20,
  hubBottomPadding: 10,
  databaseGap: 36,
} as const

/** Same status → colour mapping as the overview StatusDot. */
export function statusTone(status: string | null | undefined): TopologyTone {
  if (status === 'READY' || status === 'ACTIVE') return 'success'
  if (status === 'DEPLOYING') return 'warning'
  if (status === 'PROVISIONING') return 'info'
  if (status === 'SUSPENDED' || status === 'BILLING_ISSUE') return 'destructive'
  return 'muted'
}

const CLIENT_KIND: Partial<Record<CloudEnvironmentService['type'], TopologyNodeKind>> = {
  CONNECT: 'connect',
  FUSION: 'fusion',
  CLINT: 'agent',
}

// Connect first, then Fusion, then agents in document order.
const CLIENT_ORDER: Record<string, number> = { CONNECT: 0, FUSION: 1, CLINT: 2 }

export function buildEnvTopology(state: {
  services: readonly CloudEnvironmentService[]
  packages: readonly CloudPackage[]
}): EnvTopology {
  const L = TOPOLOGY_LAYOUT
  const enabled = state.services.filter((s) => s.enabled)
  const switchboard = enabled.find((s) => s.type === 'SWITCHBOARD') ?? null
  const clients = enabled
    .filter((s) => s.type in CLIENT_ORDER)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => CLIENT_ORDER[a.s.type] - CLIENT_ORDER[b.s.type] || a.i - b.i)
    .map(({ s }) => s)

  const clientsHeight =
    clients.length > 0 ? clients.length * L.nodeHeight + (clients.length - 1) * L.nodeGap : 0
  const packageRows = switchboard ? state.packages.length : 0
  const hubHeight = L.hubHeaderHeight + packageRows * L.packageRowHeight + L.hubBottomPadding

  // Vertically centre the shorter of the two columns against the other.
  const top = L.padding
  const columnHeight = switchboard ? Math.max(clientsHeight, hubHeight) : clientsHeight
  const clientsTop = top + (columnHeight - clientsHeight) / 2
  const hubTop = top + (columnHeight - hubHeight) / 2

  const clientX = L.padding
  const hubX = clients.length > 0 ? clientX + L.nodeWidth + L.columnGap : L.padding

  const nodes: TopologyNode[] = clients.map((s, i) => ({
    id: serviceInstanceKey(s),
    kind: CLIENT_KIND[s.type]!,
    label: serviceInstanceLabel(s),
    tone: statusTone(s.status),
    prefix: s.prefix ?? null,
    x: clientX,
    y: clientsTop + i * (L.nodeHeight + L.nodeGap),
    width: L.nodeWidth,
    height: L.nodeHeight,
  }))

  const packages: TopologyPackage[] = []
  const edges: TopologyEdge[] = []
  let width = clients.length > 0 ? clientX + L.nodeWidth + L.padding : 0
  let height = clientsHeight > 0 ? top + clientsHeight + L.padding : 0

  if (switchboard) {
    const hub: TopologyNode = {
      id: serviceInstanceKey(switchboard),
      kind: 'switchboard',
      label: serviceInstanceLabel(switchboard),
      tone: statusTone(switchboard.status),
      prefix: switchboard.prefix ?? null,
      x: hubX,
      y: hubTop,
      width: L.hubWidth,
      height: hubHeight,
    }
    state.packages.forEach((p, i) => {
      packages.push({
        name: p.name,
        version: p.version,
        x: hubX + 12,
        y: hubTop + L.hubHeaderHeight + i * L.packageRowHeight,
      })
    })

    // The database has no status of its own in the document; it follows
    // Switchboard, which owns it.
    const database: TopologyNode = {
      id: 'database',
      kind: 'database',
      label: 'Database',
      tone: hub.tone,
      prefix: null,
      x: hubX + (L.hubWidth - L.nodeWidth) / 2,
      y: hubTop + hubHeight + L.databaseGap,
      width: L.nodeWidth,
      height: L.nodeHeight,
    }

    for (const c of nodes) {
      edges.push({
        from: c.id,
        to: hub.id,
        x1: c.x + c.width,
        y1: c.y + c.height / 2,
        x2: hub.x,
        // Every client fans into the Switchboard header.
        y2: hub.y + L.hubHeaderHeight / 2,
      })
    }
    edges.push({
      from: hub.id,
      to: database.id,
      x1: hub.x + hub.width / 2,
      y1: hub.y + hub.height,
      x2: database.x + database.width / 2,
      y2: database.y,
    })

    nodes.push(hub, database)
    width = hub.x + hub.width + L.padding
    height = Math.max(height, database.y + database.height + L.padding)
  }

  return { nodes, packages, edges, width, height }
}
