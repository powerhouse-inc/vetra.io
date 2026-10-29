import type { LogEntry } from '../types'

/** Which lines the log viewer shows: everything, errors, or warnings and errors. */
export type LogLevelFilter = 'all' | 'error' | 'warn'

const ERROR_LEVELS = new Set(['error', 'fatal'])
const WARN_LEVELS = new Set(['warn', 'warning', 'error', 'fatal'])

/** Lowercased `level` of a JSON log line, or null for plain-text lines. */
export function logLevel(line: string): string | null {
  try {
    const level = (JSON.parse(line) as { level?: unknown }).level
    return typeof level === 'string' ? level.toLowerCase() : null
  } catch {
    return null
  }
}

export function isErrorLine(line: string): boolean {
  const level = logLevel(line)
  return level !== null && ERROR_LEVELS.has(level)
}

/**
 * Lines matching the level filter and the search text (case-insensitive, over the
 * raw line). Lines without a level only show under "all".
 */
export function filterLogs(
  logs: readonly LogEntry[],
  { level, query }: { level: LogLevelFilter; query: string },
): LogEntry[] {
  const q = query.trim().toLowerCase()
  const allowed = level === 'error' ? ERROR_LEVELS : level === 'warn' ? WARN_LEVELS : null
  return logs.filter((entry) => {
    if (allowed) {
      const lineLevel = logLevel(entry.line)
      if (lineLevel === null || !allowed.has(lineLevel)) return false
    }
    return !q || entry.line.toLowerCase().includes(q)
  })
}

export type LogBucket = { start: number; total: number; errors: number }

/**
 * Lines and errors over time: the span from the first to the last line split into
 * `count` equal buckets (timestamps in seconds, as the API returns them).
 */
export function logBuckets(logs: readonly LogEntry[], count = 30): LogBucket[] {
  if (logs.length === 0) return []
  const times = logs.map((entry) => entry.timestamp)
  const first = Math.min(...times)
  const span = Math.max(...times) - first
  const size = span / count || 1
  const buckets: LogBucket[] = Array.from({ length: span === 0 ? 1 : count }, (_, i) => ({
    start: first + i * size,
    total: 0,
    errors: 0,
  }))
  for (const entry of logs) {
    const index = Math.min(buckets.length - 1, Math.floor((entry.timestamp - first) / size))
    buckets[index].total += 1
    if (isErrorLine(entry.line)) buckets[index].errors += 1
  }
  return buckets
}
