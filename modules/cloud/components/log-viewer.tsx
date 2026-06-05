'use client'

import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '@/modules/cloud/types'

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
  info: { badge: 'bg-info/15 text-info', text: 'text-gray-200' },
  debug: { badge: 'bg-gray-500/20 text-gray-500', text: 'text-gray-400' },
  log: { badge: 'bg-gray-500/15 text-gray-400', text: 'text-gray-300' },
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
        <span className="shrink-0 text-gray-500 select-none">
          {formatLogTimestamp(entry.timestamp)}
        </span>
        <span className="break-all whitespace-pre-wrap text-gray-300">{entry.line}</span>
      </div>
    )
  }

  return (
    <div
      className="group -mx-1 flex cursor-pointer gap-2 rounded px-1 leading-5 hover:bg-white/[0.03]"
      onClick={() => parsed.extra && setExpanded(!expanded)}
    >
      <span className="shrink-0 text-gray-600 tabular-nums select-none">
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
        <span className="max-w-[140px] shrink-0 truncate text-gray-600" title={parsed.pod}>
          {parsed.pod.replace(/^.*-(?=(connect|switchboard|pg|pooler))/, '')}
        </span>
      )}
      {parsed.logger && <span className="shrink-0 text-purple-400/70">[{parsed.logger}]</span>}
      <span className={`break-all ${levelStyle.text}`}>
        {parsed.message}
        {parsed.extra && !expanded && (
          <span className="ml-1 text-gray-600 opacity-0 transition-opacity group-hover:opacity-100">
            +{Object.keys(parsed.extra).length} fields
          </span>
        )}
      </span>
      {expanded && parsed.extra && (
        <div className="mt-1 ml-6 text-[11px] whitespace-pre-wrap text-gray-500">
          {JSON.stringify(parsed.extra, null, 2)}
        </div>
      )}
    </div>
  )
}

type LogViewerProps = {
  logs: LogEntry[]
  isLoading?: boolean
  levelFilter?: string
}

export function LogViewer({ logs, isLoading, levelFilter }: LogViewerProps) {
  const [showRaw, setShowRaw] = useState(false)

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
  }, [logs, showRaw, levelFilter, isLoading])

  const filteredLogs = levelFilter
    ? logs.filter((entry) => {
        try {
          const obj = JSON.parse(entry.line) as Record<string, unknown>
          const entryLevel = (obj.level as string)?.toLowerCase()
          if (!entryLevel) return true
          if (levelFilter === 'warn') return entryLevel === 'warn' || entryLevel === 'warning'
          return entryLevel === levelFilter
        } catch {
          return true
        }
      })
    : logs

  return (
    <div className="rounded-lg bg-gray-950 font-mono text-xs text-gray-100">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
        <span className="text-[11px] text-gray-500">
          {filteredLogs.length} entries{levelFilter ? ` (${levelFilter})` : ''}
        </span>
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-[11px] text-gray-500 transition-colors hover:text-gray-300"
        >
          {showRaw ? 'Formatted' : 'Raw'}
        </button>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="max-h-[500px] overflow-auto p-4">
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-3 w-20 rounded bg-gray-800" />
                <div
                  className="h-3 rounded bg-gray-800"
                  style={{ width: `${40 + ((i * 17) % 40)}%` }}
                />
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No logs in this time range</p>
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
