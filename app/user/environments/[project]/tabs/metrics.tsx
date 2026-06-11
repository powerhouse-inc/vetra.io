'use client'

import { BarChart2 } from 'lucide-react'
import { useState } from 'react'

import { MetricCard } from '@/modules/cloud/components/metric-card'
import { TimeRangePicker } from '@/modules/cloud/components/time-range-picker'
import { useEnvironmentMetrics } from '@/modules/cloud/hooks/use-environment-metrics'
import type { MetricRange } from '@/modules/cloud/types'

type MetricsTabProps = {
  subdomain: string | null
  tenantId: string | null
  isStopped: boolean
  documentId: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function MetricsTab({ subdomain, tenantId, isStopped, documentId }: MetricsTabProps) {
  const [range, setRange] = useState<MetricRange>('ONE_HOUR')
  const { metrics, isLoading } = useEnvironmentMetrics(subdomain, tenantId, range, documentId)

  if (isStopped) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <BarChart2 className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-sm">Start the environment to see metrics</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Metrics</h3>
        <TimeRangePicker value={range} onChange={setRange} />
      </div>

      {/* 2x2 Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          title="CPU Usage"
          description="CPU cores consumed per pod (rate over window)"
          series={metrics?.cpu ?? []}
          formatValue={(v) => `${(v * 100).toFixed(1)}%`}
          isLoading={isLoading}
        />
        <MetricCard
          title="Memory"
          description="Working set memory per pod"
          series={metrics?.memory ?? []}
          formatValue={formatBytes}
          isLoading={isLoading}
        />
        <MetricCard
          title="Request Rate"
          description="HTTP requests per second"
          series={metrics?.requestRate ?? []}
          formatValue={(v) => `${v.toFixed(1)} req/s`}
          isLoading={isLoading}
        />
        <MetricCard
          title="Latency (p99)"
          description="99th percentile HTTP response time"
          series={metrics?.latency ?? []}
          formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
