'use client'

import { Loader2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { describePublisherError } from '../graphql'
import { usePublisherEnvironments } from '../hooks/use-publisher'

/**
 * Environments tab. Read-only: environments are produced by a server-side
 * keeper on a timer, so a licence granted moments ago has no environment yet.
 * The empty state says so, otherwise a working system looks broken. The hook
 * polls every 10s while mounted, so the row appears without a refresh.
 */
export function EnvironmentsTab({ appId }: { appId: string }) {
  const envs = usePublisherEnvironments(appId)

  if (envs.isPending) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading environments…
      </div>
    )
  }
  if (envs.error) {
    return <p className="text-destructive py-10 text-center text-sm">{describePublisherError(envs.error)}</p>
  }
  const rows = envs.data ?? []
  if (rows.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
        <p className="font-medium">No environments yet</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Environments appear shortly after a licence becomes active — provisioning runs on a timer, so it is not
          instant. This list refreshes automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border-border overflow-x-auto rounded-xl border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Holder</TableHead>
            <TableHead>Environment</TableHead>
            <TableHead>Licence</TableHead>
            <TableHead>Template</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.environmentId}>
              <TableCell className="pl-4 font-mono text-xs">{r.user}</TableCell>
              <TableCell className="font-mono text-xs">{r.environmentId}</TableCell>
              <TableCell className="font-mono text-xs">{r.licenseId}</TableCell>
              <TableCell className="font-mono text-xs">{r.templateHash.slice(0, 12)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
