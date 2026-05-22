'use client'

import { ChevronRight, File, Folder, HardDrive } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { SwitchboardAuthClient } from '@/modules/cloud/lib/switchboard-auth-client'
import { Badge } from '@/modules/shared/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/modules/shared/components/ui/collapsible'

import {
  PermissionPanel,
  type AvailableGroup,
  type DocumentAccess,
  type DocumentProtection,
  type PermissionLevel,
} from './permission-panel'

interface Props {
  client: SwitchboardAuthClient
}

interface RawNode {
  id?: string
  name?: string
  kind?: string
  documentType?: string
  parentFolder?: string | null
}

interface RawDrive {
  id: string
  name: string
  nodes: RawNode[]
}

interface DriveNode {
  id: string
  name: string
  kind: 'drive'
  children: TreeNode[]
}

interface FolderNode {
  id: string
  name: string
  kind: 'folder'
  parentFolder: string | null
  children: TreeNode[]
}

interface FileNode {
  id: string
  name: string
  kind: 'file'
  documentType: string
  parentFolder: string | null
}

type TreeNode = DriveNode | FolderNode | FileNode

const ALL_DRIVES_QUERY = `{
  findDocuments(
    search: { type: "powerhouse/document-drive" }
    paging: { limit: 500 }
  ) {
    items { id name }
    totalCount
  }
}`

const DRIVE_DOCUMENT_QUERY = `query DriveDocument($identifier: String!) {
  document(identifier: $identifier) {
    document { id name state }
  }
}`

const GROUPS_QUERY = `{ groups { id name } }`

const DOC_ACCESS_QUERY = `query DocAccess($documentId: String!) {
  documentAccess(documentId: $documentId) {
    documentId
    permissions { documentId userAddress permission grantedBy }
    groupPermissions { documentId groupId group { id name } permission grantedBy }
  }
}`

const DOC_PROTECTION_QUERY = `query DocProtection($documentId: String!) {
  documentProtection(documentId: $documentId) {
    documentId protected ownerAddress
  }
}`

const SET_PROTECTION = `mutation SetProtection($documentId: String!, $protected: Boolean!) {
  setDocumentProtection(documentId: $documentId, protected: $protected) {
    documentId protected ownerAddress
  }
}`

const TRANSFER_OWNERSHIP = `mutation TransferOwnership($documentId: String!, $newOwnerAddress: String!) {
  transferDocumentOwnership(documentId: $documentId, newOwnerAddress: $newOwnerAddress) {
    documentId protected ownerAddress
  }
}`

const GRANT_PERMISSION = `mutation Grant($documentId: String!, $userAddress: String!, $permission: DocumentPermissionLevel!) {
  grantDocumentPermission(documentId: $documentId, userAddress: $userAddress, permission: $permission) {
    documentId userAddress permission
  }
}`

const REVOKE_PERMISSION = `mutation Revoke($documentId: String!, $userAddress: String!) {
  revokeDocumentPermission(documentId: $documentId, userAddress: $userAddress)
}`

const GRANT_GROUP_PERMISSION = `mutation GrantGroup($documentId: String!, $groupId: Int!, $permission: DocumentPermissionLevel!) {
  grantGroupPermission(documentId: $documentId, groupId: $groupId, permission: $permission) {
    documentId groupId permission
  }
}`

const REVOKE_GROUP_PERMISSION = `mutation RevokeGroup($documentId: String!, $groupId: Int!) {
  revokeGroupPermission(documentId: $documentId, groupId: $groupId)
}`

/**
 * Build a tree of drive → folder → file nodes from the flat
 * `state.global.nodes` arrays returned by each drive document.
 */
function buildTree(drives: RawDrive[]): DriveNode[] {
  return drives.map((drive) => {
    const folders = new Map<string, FolderNode>()
    const rootChildren: TreeNode[] = []

    // First pass: create all folder nodes
    for (const n of drive.nodes) {
      if (!n.id || n.kind !== 'folder') continue
      folders.set(n.id, {
        id: n.id,
        name: n.name || 'Untitled folder',
        kind: 'folder',
        parentFolder: n.parentFolder ?? null,
        children: [],
      })
    }

    // Second pass: attach folders + files to parents
    for (const n of drive.nodes) {
      if (!n.id) continue

      if (n.kind === 'folder') {
        const folder = folders.get(n.id)
        if (!folder) continue
        const parent = n.parentFolder ? folders.get(n.parentFolder) : null
        if (parent) parent.children.push(folder)
        else rootChildren.push(folder)
      } else if (n.documentType) {
        const file: FileNode = {
          id: n.id,
          name: n.name || 'Untitled',
          kind: 'file',
          documentType: n.documentType,
          parentFolder: n.parentFolder ?? null,
        }
        const parent = n.parentFolder ? folders.get(n.parentFolder) : null
        if (parent) parent.children.push(file)
        else rootChildren.push(file)
      }
    }

    return {
      id: drive.id,
      name: drive.name || 'Untitled drive',
      kind: 'drive' as const,
      children: rootChildren,
    }
  })
}

function TypeChip({ type }: { type: string }) {
  const short = type.includes('/') ? type.split('/').pop() : type
  return (
    <Badge variant="outline" size="xs" className="font-mono">
      {short}
    </Badge>
  )
}

function NodeIcon({ kind }: { kind: TreeNode['kind'] }) {
  if (kind === 'drive') return <HardDrive className="text-foreground h-3.5 w-3.5 shrink-0" />
  if (kind === 'folder') return <Folder className="text-foreground h-3.5 w-3.5 shrink-0" />
  return <File className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
}

// Pre-computed indentation classes for the tree. Using a class map keeps
// us off inline styles (per design-system rules) while supporting arbitrary
// depths via a clamp at INDENT_CLASSES.length - 1.
const INDENT_CLASSES = [
  'pl-2',
  'pl-6',
  'pl-10',
  'pl-14',
  'pl-[4.5rem]',
  'pl-[5.5rem]',
  'pl-[6.5rem]',
  'pl-[7.5rem]',
  'pl-[8.5rem]',
  'pl-[9.5rem]',
] as const

function indentClass(depth: number): string {
  return INDENT_CLASSES[Math.min(depth, INDENT_CLASSES.length - 1)]
}

function TreeRow({
  node,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
}: {
  node: TreeNode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
}) {
  const isSelected = selectedId === node.id
  const indent = indentClass(depth)

  if (node.kind === 'file') {
    return (
      <div
        className={`flex items-center gap-1.5 border-l-2 py-1.5 pr-2 text-xs ${indent} ${
          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/30 border-transparent'
        }`}
      >
        <span className="inline-block w-4 shrink-0" />
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <NodeIcon kind="file" />
          <span className="truncate" title={node.name}>
            {node.name}
          </span>
          <TypeChip type={node.documentType} />
        </button>
        <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
          {node.id.slice(0, 8)}
        </span>
      </div>
    )
  }

  // Container (drive | folder) — wrap children in Collapsible so the
  // expand/collapse state lives in the Radix primitive.
  const hasChildren = node.children.length > 0
  const isExpanded = expandedIds.has(node.id)

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggleExpand(node.id)}>
      <div
        className={`flex items-center gap-1.5 border-l-2 py-1.5 pr-2 text-xs ${indent} ${
          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/30 border-transparent'
        }`}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            disabled={!hasChildren}
            className={`text-muted-foreground inline-flex h-4 w-4 shrink-0 items-center justify-center ${
              hasChildren ? 'cursor-pointer' : 'cursor-default opacity-30'
            }`}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            tabIndex={-1}
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        </CollapsibleTrigger>
        <button
          type="button"
          onClick={() => {
            if (!isExpanded && hasChildren) onToggleExpand(node.id)
            onSelect(node.id)
          }}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <NodeIcon kind={node.kind} />
          <span
            className={`truncate ${node.kind === 'drive' ? 'font-semibold' : ''}`}
            title={node.name}
          >
            {node.name}
          </span>
          {node.kind === 'drive' && (
            <Badge variant="outline" size="xs" className="ml-auto">
              Drive
            </Badge>
          )}
        </button>
        <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
          {node.id.slice(0, 8)}
        </span>
      </div>
      <CollapsibleContent>
        {node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function DocumentPermissionsTab({ client }: Props) {
  const [drives, setDrives] = useState<RawDrive[]>([])
  const [drivesLoading, setDrivesLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const [access, setAccess] = useState<DocumentAccess | null>(null)
  const [accessLoading, setAccessLoading] = useState(false)
  const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([])
  const [protection, setProtection] = useState<DocumentProtection | null>(null)

  const selectedLabel = useRef('')

  const loadDrives = useCallback(async () => {
    setDrivesLoading(true)
    setError('')
    try {
      const list = await client.query<{
        findDocuments: { items: { id: string; name: string }[] }
      }>(ALL_DRIVES_QUERY)

      const fetched: RawDrive[] = await Promise.all(
        list.findDocuments.items.map(async (d) => {
          try {
            const docRes = await client.query<{
              document: {
                document: {
                  id: string
                  name: string
                  state: { global?: { nodes?: RawNode[] } } | null
                } | null
              } | null
            }>(DRIVE_DOCUMENT_QUERY, { identifier: d.id })
            const nodes = docRes.document?.document?.state?.global?.nodes ?? []
            return { id: d.id, name: d.name, nodes }
          } catch {
            return { id: d.id, name: d.name, nodes: [] }
          }
        }),
      )
      setDrives(fetched)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load drives')
      setDrives([])
    } finally {
      setDrivesLoading(false)
    }
  }, [client])

  useEffect(() => {
    void loadDrives()
  }, [loadDrives])

  const tree = useMemo(() => buildTree(drives), [drives])

  // Auto-expand drives the first time we get a non-empty tree.
  useEffect(() => {
    if (tree.length === 0) return
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev
      return new Set(tree.map((d) => d.id))
    })
  }, [tree])

  const loadGroups = useCallback(async () => {
    try {
      const data = await client.query<{ groups: AvailableGroup[] }>(GROUPS_QUERY)
      setAvailableGroups(data.groups)
    } catch {
      // Silently fail — the grant-group form will just show an empty dropdown.
    }
  }, [client])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  const loadAccess = useCallback(
    async (docId: string) => {
      setAccessLoading(true)
      setAccess(null)
      setError('')
      try {
        const data = await client.query<{ documentAccess: DocumentAccess }>(DOC_ACCESS_QUERY, {
          documentId: docId,
        })
        setAccess(data.documentAccess)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load permissions')
      } finally {
        setAccessLoading(false)
      }
    },
    [client],
  )

  const loadProtection = useCallback(
    async (docId: string) => {
      setProtection(null)
      try {
        const data = await client.query<{ documentProtection: DocumentProtection }>(
          DOC_PROTECTION_QUERY,
          { documentId: docId },
        )
        setProtection(data.documentProtection)
      } catch {
        // Subgraph may be disabled — leave protection unset.
      }
    },
    [client],
  )

  function findNodeLabel(id: string): string {
    for (const drive of tree) {
      if (drive.id === id) return drive.name
      const found = findInChildren(drive.children, id)
      if (found) return found
    }
    return `${id.slice(0, 8)}…`
  }

  function findInChildren(nodes: TreeNode[], id: string): string | null {
    for (const n of nodes) {
      if (n.id === id) return n.name
      if ('children' in n) {
        const found = findInChildren(n.children, id)
        if (found) return found
      }
    }
    return null
  }

  const handleSelect = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null)
      setAccess(null)
      setProtection(null)
      return
    }
    setSelectedId(id)
    selectedLabel.current = findNodeLabel(id)
    void loadAccess(id)
    void loadProtection(id)
  }

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleGrantUser = async (address: string, level: PermissionLevel) => {
    if (!selectedId) return
    try {
      await client.query(GRANT_PERMISSION, {
        documentId: selectedId,
        userAddress: address,
        permission: level,
      })
      toast.success('Permission granted')
      void loadAccess(selectedId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to grant permission'
      setError(msg)
      toast.error(msg)
    }
  }

  const handleRevokeUser = async (userAddress: string) => {
    if (!selectedId) return
    try {
      await client.query(REVOKE_PERMISSION, { documentId: selectedId, userAddress })
      toast.success('Permission revoked')
      void loadAccess(selectedId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to revoke permission'
      setError(msg)
      toast.error(msg)
    }
  }

  const handleGrantGroup = async (groupId: number, level: PermissionLevel) => {
    if (!selectedId) return
    try {
      await client.query(GRANT_GROUP_PERMISSION, {
        documentId: selectedId,
        groupId,
        permission: level,
      })
      toast.success('Group permission granted')
      void loadAccess(selectedId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to grant group permission'
      setError(msg)
      toast.error(msg)
    }
  }

  const handleRevokeGroup = async (groupId: number) => {
    if (!selectedId) return
    try {
      await client.query(REVOKE_GROUP_PERMISSION, { documentId: selectedId, groupId })
      toast.success('Group permission revoked')
      void loadAccess(selectedId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to revoke group permission'
      setError(msg)
      toast.error(msg)
    }
  }

  const handleSetProtection = async (next: boolean) => {
    if (!selectedId) return
    try {
      await client.query(SET_PROTECTION, { documentId: selectedId, protected: next })
      toast.success(next ? 'Document protected' : 'Document unprotected')
      void loadProtection(selectedId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update document protection'
      setError(msg)
      toast.error(msg)
    }
  }

  const handleTransferOwnership = async (newOwnerAddress: string) => {
    if (!selectedId) return
    try {
      await client.query(TRANSFER_OWNERSHIP, {
        documentId: selectedId,
        newOwnerAddress,
      })
      toast.success('Ownership transferred')
      void loadProtection(selectedId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to transfer ownership'
      setError(msg)
      toast.error(msg)
    }
  }

  if (drivesLoading) {
    return <p className="text-muted-foreground py-6 text-center text-sm">Loading drives…</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Document permissions</h3>
        <p className="text-muted-foreground text-xs">
          Select a drive, folder or document to manage its permissions.
        </p>
      </div>

      <div className="bg-muted/20 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-[11px]">
        <span className="text-foreground font-semibold">Permission levels:</span>
        <span className="flex items-center gap-1">
          <span className="bg-info inline-block h-2 w-2 rounded-sm" />
          READ — view only
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-warning inline-block h-2 w-2 rounded-sm" />
          WRITE — can edit
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-destructive inline-block h-2 w-2 rounded-sm" />
          ADMIN — full control
        </span>
      </div>

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-md p-3 text-sm">{error}</div>
      )}

      {tree.length === 0 ? (
        <p className="text-muted-foreground rounded-md border p-6 text-center text-sm">
          No drives found.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-md border">
            <div className="bg-muted/40 border-b px-3 py-1.5 text-[11px] font-medium">Tree</div>
            <div className="max-h-[500px] overflow-auto">
              {tree.map((drive) => (
                <TreeRow
                  key={drive.id}
                  node={drive}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                />
              ))}
            </div>
          </div>

          <div>
            {selectedId === null ? (
              <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
                Select a drive, folder or document from the tree to view and manage its permissions.
              </div>
            ) : accessLoading ? (
              <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
                Loading permissions…
              </div>
            ) : access ? (
              <PermissionPanel
                access={access}
                availableGroups={availableGroups}
                nodeLabel={selectedLabel.current}
                onGrantUser={(addr, level) => handleGrantUser(addr, level)}
                onRevokeUser={(addr) => handleRevokeUser(addr)}
                onGrantGroup={(gid, level) => handleGrantGroup(gid, level)}
                onRevokeGroup={(gid) => handleRevokeGroup(gid)}
                onRefreshGroups={() => void loadGroups()}
                protection={protection}
                onSetProtection={(next) => handleSetProtection(next)}
                onTransferOwnership={(addr) => handleTransferOwnership(addr)}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
