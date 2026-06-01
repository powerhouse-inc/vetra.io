'use client'

import { ArrowRight, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/shared/components/ui/card'
import type { PackageUpdate } from '../hooks/use-package-updates'
import type { ServiceUpdate } from '../hooks/use-service-updates'

type Props = {
  serviceUpdates: ServiceUpdate[]
  packageUpdates: PackageUpdate[]
  onUpdateService: (serviceType: string, version: string) => Promise<void>
  onUpdatePackage: (packageName: string, version: string) => Promise<void>
}

export function AvailableUpdatesCard({
  serviceUpdates,
  packageUpdates,
  onUpdateService,
  onUpdatePackage,
}: Props) {
  const [updating, setUpdating] = useState<Set<string>>(new Set())
  const [updatingAll, setUpdatingAll] = useState(false)

  const totalUpdates = serviceUpdates.length + packageUpdates.length
  if (totalUpdates === 0) return null

  const markUpdating = (key: string) => setUpdating((prev) => new Set(prev).add(key))
  const clearUpdating = (key: string) =>
    setUpdating((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })

  const handleUpdateService = async (serviceType: string, version: string) => {
    const key = `service:${serviceType}`
    markUpdating(key)
    try {
      await onUpdateService(serviceType, version)
      toast.success(`${serviceType} updated to ${version}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to update ${serviceType}`)
    } finally {
      clearUpdating(key)
    }
  }

  const handleUpdatePackage = async (packageName: string, version: string) => {
    const key = `package:${packageName}`
    markUpdating(key)
    try {
      await onUpdatePackage(packageName, version)
      toast.success(`${packageName} updated to ${version}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to update ${packageName}`)
    } finally {
      clearUpdating(key)
    }
  }

  const handleUpdateAll = async () => {
    setUpdatingAll(true)
    try {
      for (const update of serviceUpdates) {
        await handleUpdateService(update.serviceType, update.latestVersion)
      }
      for (const update of packageUpdates) {
        await handleUpdatePackage(update.packageName, update.latestVersion)
      }
    } finally {
      setUpdatingAll(false)
    }
  }

  return (
    <Card className="border-blue-500/30 bg-blue-500/5 dark:border-blue-500/20 dark:bg-blue-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" />
              Available Updates
            </CardTitle>
            <Badge
              variant="outline"
              className="border-blue-500/30 bg-blue-500/10 text-xs text-blue-500"
            >
              {totalUpdates}
            </Badge>
          </div>
          <Button size="sm" onClick={handleUpdateAll} disabled={updatingAll}>
            {updatingAll ? 'Updating...' : 'Update All'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {serviceUpdates.map((update) => {
          const key = `service:${update.serviceType}`
          return (
            <div key={key} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{update.serviceType}</p>
                  {update.channel && update.channel !== 'latest' && (
                    <Badge variant="secondary" className="text-[10px]">
                      {update.channel}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs">
                  <span>{update.currentVersion ?? 'not set'}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-emerald-500">{update.latestVersion}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateService(update.serviceType, update.latestVersion)}
                disabled={updating.has(key) || updatingAll}
              >
                {updating.has(key) ? 'Updating...' : 'Update'}
              </Button>
            </div>
          )
        })}
        {packageUpdates.map((update) => {
          const key = `package:${update.packageName}`
          return (
            <div key={key} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{update.packageName}</p>
                  {'channel' in update && (update).channel !== 'latest' && (
                    <Badge variant="secondary" className="text-[10px]">
                      {(update).channel}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs">
                  <span>{update.currentVersion ?? 'not set'}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-emerald-500">{update.latestVersion}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdatePackage(update.packageName, update.latestVersion)}
                disabled={updating.has(key) || updatingAll}
              >
                {updating.has(key) ? 'Updating...' : 'Update'}
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
