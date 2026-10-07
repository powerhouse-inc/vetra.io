'use client'

import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
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
      <div className="text-muted-foreground flex items-center gap-2 py-10">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading environments…
      </div>
    )
  }
  if (envs.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load environments</AlertTitle>
        <AlertDescription>{describePublisherError(envs.error)}</AlertDescription>
      </Alert>
    )
  }
  const rows = envs.data ?? []
  if (rows.length === 0) {
    return (
      <div className="border-border rounded-xl border border-dashed p-10 text-center">
        <h3 className="font-medium">No environments yet</h3>
        <p className="text-muted-foreground mt-2 text-sm">
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
