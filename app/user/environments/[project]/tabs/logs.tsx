'use client'

import { RefreshCw, FileText } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { LogViewer } from '@/modules/cloud/components/log-viewer'
import { TimeRangePicker } from '@/modules/cloud/components/time-range-picker'
import { useEnvironmentLogs } from '@/modules/cloud/hooks/use-environment-logs'
import type { MetricRange, TenantService } from '@/modules/cloud/types'
import { Button } from '@/modules/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/modules/shared/components/ui/dropdown-menu'

type LogsTabProps = {
  subdomain: string | null
  tenantId: string | null
  isStopped: boolean
}

const SERVICE_OPTIONS: { value: TenantService | null; label: string }[] = [
  { value: null, label: 'All Services' },
  { value: 'CONNECT', label: 'Connect' },
  { value: 'SWITCHBOARD', label: 'Switchboard' },
]

type LogLevel = 'all' | 'error' | 'warn' | 'info' | 'debug'
const LOG_LEVELS: { value: LogLevel; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warning' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
]

export function LogsTab({ subdomain, tenantId, isStopped }: LogsTabProps) {
  const [service, setService] = useState<TenantService | null>(null)
  const [range, setRange] = useState<MetricRange>('ONE_HOUR')
  const [level, setLevel] = useState<LogLevel>('all')

  const errorsOnly = level === 'error'
  const { logs, isLoading, refresh } = useEnvironmentLogs(
    subdomain,
    tenantId,
    service,
    range,
    errorsOnly,
  )

  if (isStopped) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <FileText className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-sm">Start the environment to see logs</p>
      </div>
    )
  }

  const serviceLabel = SERVICE_OPTIONS.find((o) => o.value === service)?.label ?? 'All Services'
  const levelLabel = LOG_LEVELS.find((o) => o.value === level)?.label ?? 'All Levels'

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Service Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              {serviceLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SERVICE_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.label}
                onClick={() => setService(opt.value)}
                className={service === opt.value ? 'bg-accent' : undefined}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Log Level */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              {levelLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {LOG_LEVELS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setLevel(opt.value)}
                className={level === opt.value ? 'bg-accent' : undefined}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Time Range */}
        <TimeRangePicker value={range} onChange={setRange} />

        {/* Refresh */}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto flex items-center gap-1.5"
          onClick={() => void refresh()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Log Viewer */}
      <LogViewer
        logs={logs}
        isLoading={isLoading}
        levelFilter={level === 'all' ? undefined : level}
      />
    </div>
  )
}
