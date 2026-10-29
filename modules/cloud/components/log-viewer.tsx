'use client'

import { useEffect, useRef, useState } from 'react'
import { filterLogs, logBuckets, type LogLevelFilter } from '@/modules/cloud/lib/log-filter'
import type { LogEntry } from '@/modules/cloud/types'
import { cn } from '@/shared/lib/utils'

function formatLogTimestamp(ts: number): string {
  const date = new Date(ts * 1000)
  return date.toISOString().slice(11, 23) // HH:mm:ss.SSS
}

type ParsedLog = {
  level: string | null
  message: string
  pod: string | null
  logger: string | null
  extra: Record<string, unknown> | null
  raw: string
}

const LEVEL_STYLES: Record<string, { badge: string; text: string }> = {
  error: { badge: 'bg-destructive/20 text-destructive', text: 'text-red-300' },
  warn: { badge: 'bg-warning/20 text-warning', text: 'text-amber-200' },
  warning: { badge: 'bg-warning/20 text-warning', text: 'text-amber-200' },
  info: { badge: 'bg-info/15 text-info', text: 'text-console-ink' },
  debug: { badge: 'bg-console-raised text-console-muted', text: 'text-console-muted' },
  log: { badge: 'bg-console-raised text-console-muted', text: 'text-console-ink/90' },
}

function parseLogLine(line: string): ParsedLog {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>
    const level = (obj.level as string)?.toLowerCase() ?? null
    const msg =
      (obj.msg as string) ??
      (obj.message as string) ??
      ((obj.record as Record<string, unknown>)?.message as string) ??
      ''
    const pod = (obj.logging_pod as string) ?? null
    const logger = (obj.logger as string) ?? null

    const skipKeys = new Set([
      'level',
      'msg',
      'message',
      'ts',
      'time',
      'timestamp',
      'logging_pod',
      'logger',
    ])
    const extra: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (!skipKeys.has(k) && v !== undefined && v !== null && v !== '') {
        extra[k] = v
      }
    }

    return {
      level,
      message: msg,
      pod,
      logger,
      extra: Object.keys(extra).length > 0 ? extra : null,
      raw: line,
    }
  } catch {
    return { level: null, message: line, pod: null, logger: null, extra: null, raw: line }
  }
}

function LogLine({ entry, showRaw }: { entry: LogEntry; showRaw: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const parsed = parseLogLine(entry.line)
  const levelStyle = parsed.level
    ? (LEVEL_STYLES[parsed.level] ?? LEVEL_STYLES.log)
    : LEVEL_STYLES.log

  if (showRaw) {
    return (
      <div className="flex gap-2 leading-5 hover:bg-white/[0.03]">
        <span className="text-console-muted shrink-0 select-none">
          {formatLogTimestamp(entry.timestamp)}
        </span>
        <span className="text-console-ink/90 break-all whitespace-pre-wrap">{entry.line}</span>
      </div>
    )
  }

  return (
    <div
      className="group -mx-1 flex cursor-pointer gap-2 rounded px-1 leading-5 hover:bg-white/[0.03]"
      onClick={() => parsed.extra && setExpanded(!expanded)}
    >
      <span className="text-console-faint shrink-0 tabular-nums select-none">
        {formatLogTimestamp(entry.timestamp)}
      </span>
      {parsed.level && (
        <span
          className={`shrink-0 rounded px-1.5 py-0 text-[10px] leading-5 font-semibold uppercase ${levelStyle.badge}`}
        >
          {parsed.level.slice(0, 4)}
        </span>
      )}
      {parsed.pod && (
        <span className="text-console-faint max-w-[140px] shrink-0 truncate" title={parsed.pod}>
          {parsed.pod.replace(/^.*-(?=(connect|switchboard|pg|pooler))/, '')}
        </span>
      )}
      {parsed.logger && <span className="shrink-0 text-purple-400/70">[{parsed.logger}]</span>}
      <span className={`break-all ${levelStyle.text}`}>
        {parsed.message}
        {parsed.extra && !expanded && (
          <span className="text-console-faint ml-1 opacity-0 transition-opacity group-hover:opacity-100">
            +{Object.keys(parsed.extra).length} fields
          </span>
        )}
      </span>
      {expanded && parsed.extra && (
        <div className="text-console-muted mt-1 ml-6 text-[11px] whitespace-pre-wrap">
          {JSON.stringify(parsed.extra, null, 2)}
        </div>
      )}
    </div>
  )
}

type LogViewerProps = {
  logs: LogEntry[]
  isLoading?: boolean
}

const LEVEL_OPTIONS: { value: LogLevelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'error', label: 'Errors' },
  { value: 'warn', label: 'Warnings' },
]

const toolbarButton = (active: boolean) =>
  cn(
    'rounded px-2 py-0.5 text-[11px] transition-colors',
    active ? 'bg-console-raised text-console-ink' : 'text-console-muted hover:text-console-ink',
  )

/** Lines per time bucket; red where the bucket holds errors. */
function LogHistogram({ logs }: { logs: readonly LogEntry[] }) {
  const buckets = logBuckets(logs)
  const max = Math.max(1, ...buckets.map((b) => b.total))
  if (buckets.length < 2) return null
  return (
    <div className="flex h-8 items-end gap-px px-4 pt-2" aria-hidden>
      {buckets.map((bucket) => (
        <div
          key={bucket.start}
          title={`${formatLogTimestamp(bucket.start).slice(0, 8)} · ${bucket.total} lines, ${bucket.errors} errors`}
          className={cn(
            'min-h-px flex-1 rounded-t-sm',
            bucket.errors > 0 ? 'bg-destructive' : 'bg-console-line-strong',
          )}
          style={{ height: `${(bucket.total / max) * 100}%` }}
        />
      ))}
    </div>
  )
}

export function LogViewer({ logs: liveLogs, isLoading }: LogViewerProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [level, setLevel] = useState<LogLevelFilter>('all')
  const [query, setQuery] = useState('')
  // Pausing freezes what is shown; the poll keeps running underneath.
  const [frozen, setFrozen] = useState<LogEntry[] | null>(null)
  const logs = frozen ?? liveLogs
  const newSincePause = frozen ? Math.max(0, liveLogs.length - frozen.length) : 0

  // Logs render oldest→newest (newest at the bottom), like a terminal tail.
  // Keep the view pinned to the bottom so the newest line is visible, but only
  // while the user is already at the bottom — if they've scrolled up to read
  // history, incoming logs (10s poll) won't yank them back down.
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [logs, showRaw, level, query, isLoading])

  const filteredLogs = filterLogs(logs, { level, query })
  const filtering = level !== 'all' || query.trim() !== ''

  return (
    <div className="bg-console-bg text-console-ink rounded-lg font-mono text-xs">
      <div className="border-console-line-strong flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <input
          id="log-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search logs"
          aria-label="Search logs"
          className="border-console-line-strong placeholder:text-console-muted focus-visible:ring-ring h-7 min-w-0 flex-1 rounded border bg-transparent px-2 text-[11px] focus-visible:ring-1 focus-visible:outline-none sm:max-w-56"
        />
        <div className="flex gap-0.5" role="group" aria-label="Log level">
          {LEVEL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={level === option.value}
              onClick={() => setLevel(option.value)}
              className={toolbarButton(level === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="text-console-muted ml-auto text-[11px]">
          {filtering ? `${filteredLogs.length} of ${logs.length}` : `${logs.length}`} entries
          {frozen && ` · paused${newSincePause ? `, ${newSincePause} new` : ''}`}
        </span>
        <button
          type="button"
          onClick={() => setFrozen(frozen ? null : liveLogs)}
          className={toolbarButton(!!frozen)}
        >
          {frozen ? 'Resume' : 'Pause'}
        </button>
        <button type="button" onClick={() => setShowRaw(!showRaw)} className={toolbarButton(false)}>
          {showRaw ? 'Formatted' : 'Raw'}
        </button>
      </div>
      {!isLoading && <LogHistogram logs={logs} />}
      <div ref={scrollRef} onScroll={handleScroll} className="max-h-[500px] overflow-auto p-4">
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="bg-console-raised h-3 w-20 rounded" />
                <div
                  className="bg-console-raised h-3 rounded"
                  style={{ width: `${40 + ((i * 17) % 40)}%` }}
                />
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <p className="text-console-muted py-8 text-center">
            {filtering ? 'No lines match these filters' : 'No logs in this time range'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {filteredLogs.map((entry, i) => (
              <LogLine key={i} entry={entry} showRaw={showRaw} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
