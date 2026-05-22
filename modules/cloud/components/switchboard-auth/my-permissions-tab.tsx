'use client'

import { Copy, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { SwitchboardAuthClient } from '@/modules/cloud/lib/switchboard-auth-client'
import { formatAddress, useEnsName } from '@/modules/cloud/hooks/use-ens-name'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'

import { EnsAddress } from './ens-address'

type PermissionLevel = 'READ' | 'WRITE' | 'ADMIN'

interface UserDocPermission {
  documentId: string
  permission: PermissionLevel
  grantedBy: string
  createdAt: string
}

interface UserGroup {
  id: number
  name: string
  description: string | null
  members: string[]
}

interface DocumentMeta {
  name: string
  documentType: string
}

interface Props {
  client: SwitchboardAuthClient
  viewerAddress: string
}

const MY_PERMISSIONS_QUERY = `{
  userDocumentPermissions {
    documentId permission grantedBy createdAt
  }
}`

const USER_GROUPS_QUERY = `query UserGroups($userAddress: String!) {
  userGroups(userAddress: $userAddress) {
    id name description members
  }
}`

const DOCUMENT_META_QUERY = `query DocumentMeta($id: String!) {
  document(identifier: $id) {
    document { id name documentType }
  }
}`

/**
 * Click-to-copy chip for a document id. Truncates the id for display and
 * briefly swaps in a "Copied!" affordance on click.
 */
function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  const onClick = useCallback(() => {
    void navigator.clipboard
      .writeText(id)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      })
      .catch(() => {
        // Clipboard may be blocked in some embedded contexts; fail silently.
      })
  }, [id])

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${id}\n\nClick to copy`}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
        copied
          ? 'bg-success/15 border-success/40 text-success'
          : 'bg-muted/60 hover:bg-muted text-muted-foreground border-transparent'
      }`}
    >
      <span>{copied ? 'Copied!' : `${id.slice(0, 8)}…`}</span>
      {!copied && <Copy className="h-2.5 w-2.5" />}
    </button>
  )
}

function PermissionBadge({ level }: { level: PermissionLevel }) {
  if (level === 'READ') {
    return (
      <Badge variant="secondary" size="xs" className="bg-info/15 text-info border-transparent">
        READ
      </Badge>
    )
  }
  if (level === 'WRITE') {
    return (
      <Badge size="xs" className="bg-warning/15 text-warning border-transparent">
        WRITE
      </Badge>
    )
  }
  return (
    <Badge size="xs" className="bg-destructive/15 text-destructive border-transparent">
      ADMIN
    </Badge>
  )
}

export function MyPermissionsTab({ client, viewerAddress }: Props) {
  const [permissions, setPermissions] = useState<UserDocPermission[]>([])
  const [docMeta, setDocMeta] = useState<Record<string, DocumentMeta | undefined>>({})
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lookupAddress, setLookupAddress] = useState(viewerAddress)
  const ensName = useEnsName(viewerAddress)

  const loadDocumentMeta = useCallback(
    async (ids: string[]) => {
      // findDocuments rejects `identifiers` alone as search criteria ("No
      // search criteria provided"). Fall back to N+1 — one document(identifier)
      // per id in parallel. Missing/deleted docs surface as a per-id error;
      // we catch and skip them so the perm row still renders with "—".
      const unique = Array.from(new Set(ids)).filter(Boolean)
      const results = await Promise.all(
        unique.map(async (id) => {
          try {
            const data = await client.query<{
              document: {
                document: { id: string; name: string; documentType: string }
              } | null
            }>(DOCUMENT_META_QUERY, { id })
            const doc = data.document?.document
            if (!doc) return null
            return [id, { name: doc.name, documentType: doc.documentType }] as const
          } catch {
            return null
          }
        }),
      )
      const map: Record<string, DocumentMeta | undefined> = {}
      for (const r of results) {
        if (r) map[r[0]] = r[1]
      }
      setDocMeta(map)
    },
    [client],
  )

  const loadMyPermissions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await client.query<{
        userDocumentPermissions: UserDocPermission[]
      }>(MY_PERMISSIONS_QUERY)
      setPermissions(data.userDocumentPermissions)
      if (data.userDocumentPermissions.length > 0) {
        void loadDocumentMeta(data.userDocumentPermissions.map((p) => p.documentId))
      } else {
        setDocMeta({})
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load permissions'
      // The reactor-api occasionally raises "toLowerCase of null" when the
      // viewer has no address resolved server-side. Treat as empty grants
      // rather than surfacing a confusing stack trace.
      if (msg.includes('toLowerCase')) {
        setPermissions([])
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [client, loadDocumentMeta])

  const loadUserGroups = useCallback(
    async (addr: string) => {
      try {
        const data = await client.query<{ userGroups: UserGroup[] }>(USER_GROUPS_QUERY, {
          userAddress: addr,
        })
        setGroups(data.userGroups)
      } catch {
        // Silently fail — groups stay empty.
      }
    },
    [client],
  )

  useEffect(() => {
    void loadMyPermissions()
    void loadUserGroups(viewerAddress)
  }, [loadMyPermissions, loadUserGroups, viewerAddress])

  const lookupGroups = async () => {
    if (!lookupAddress.trim()) return
    setError('')
    try {
      const data = await client.query<{ userGroups: UserGroup[] }>(USER_GROUPS_QUERY, {
        userAddress: lookupAddress.trim(),
      })
      setGroups(data.userGroups)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user groups')
    }
  }

  if (loading) {
    return <p className="text-muted-foreground py-6 text-center text-sm">Loading permissions…</p>
  }

  return (
    <div className="space-y-6">
      {/* Identity card */}
      <div className="bg-info/5 border-info/30 rounded-md border p-3">
        <div className="text-foreground text-sm font-semibold">Signed in</div>
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          {formatAddress(viewerAddress, ensName)}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          In v6 your access is the union of any document permissions and group memberships below.
          There is no global role.
        </p>
      </div>

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-md p-3 text-sm">{error}</div>
      )}

      {/* My document permissions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">My document permissions</h3>
        {permissions.length === 0 ? (
          <p className="text-muted-foreground rounded-md border p-4 text-center text-sm">
            No explicit document permissions found. You can still access any unprotected document.
          </p>
        ) : (
          <div className="max-h-[400px] overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 sticky top-0 z-10">
                <tr>
                  <th className="border-b px-3 py-2 text-left font-medium">Name</th>
                  <th className="border-b px-3 py-2 text-left font-medium">Type</th>
                  <th className="border-b px-3 py-2 text-left font-medium">Permission</th>
                  <th className="border-b px-3 py-2 text-left font-medium">Granted by</th>
                  <th className="border-b px-3 py-2 text-left font-medium">Created</th>
                  <th className="border-b px-3 py-2 text-left font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => {
                  const meta = docMeta[p.documentId]
                  return (
                    <tr key={p.documentId} className="hover:bg-muted/30">
                      <td
                        className={`border-b px-3 py-2 ${meta?.name ? '' : 'text-muted-foreground'}`}
                      >
                        {meta?.name ?? '—'}
                      </td>
                      <td className="border-b px-3 py-2">
                        {meta?.documentType ? (
                          <Badge variant="outline" size="xs" className="font-mono">
                            {meta.documentType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="border-b px-3 py-2">
                        <PermissionBadge level={p.permission} />
                      </td>
                      <td className="text-muted-foreground border-b px-3 py-2 font-mono">
                        {p.grantedBy ? <EnsAddress address={p.grantedBy} /> : '—'}
                      </td>
                      <td className="text-muted-foreground border-b px-3 py-2 whitespace-nowrap">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="border-b px-3 py-2">
                        <CopyId id={p.documentId} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* My groups */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">My groups</h3>
        {groups.length === 0 ? (
          <p className="text-muted-foreground rounded-md border p-4 text-center text-sm">
            Not a member of any groups.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <div key={g.id} className="bg-muted/30 rounded-md border px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold">{g.name}</span>
                  {g.description && (
                    <span className="text-muted-foreground text-xs">— {g.description}</span>
                  )}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {g.members.length} member{g.members.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User lookup */}
      <div className="border-t pt-4">
        <h3 className="mb-3 text-sm font-semibold">User group lookup</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void lookupGroups()
          }}
          className="flex gap-2"
        >
          <Input
            value={lookupAddress}
            onChange={(e) => setLookupAddress(e.target.value)}
            placeholder="0x… address"
            className="h-8 flex-1 font-mono text-xs"
          />
          <Button type="submit" size="sm" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Lookup
          </Button>
        </form>
      </div>
    </div>
  )
}
