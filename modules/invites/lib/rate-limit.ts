// Tiny in-memory fixed-window rate limiter. No dependencies, no shared store —
// counts live in this process's memory, so the limit is *per server instance*.
// That's fine for the invite endpoints at this scale (a few codes, low traffic);
// if vetra ever runs many instances and needs a global limit, swap the Map for
// Redis/Postgres behind the same interface.
import { RATE_LIMIT_MAX_BUCKETS } from './constants'

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the window resets (only meaningful when !allowed). */
  retryAfterSec: number
}

/** Allow up to `limit` calls per `windowMs` for a given key. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > RATE_LIMIT_MAX_BUCKETS) pruneExpired(now)
    return { allowed: true, retryAfterSec: 0 }
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) }
  }

  existing.count += 1
  return { allowed: true, retryAfterSec: 0 }
}

/** Best-effort client IP from common proxy headers; groups everything under
 * "unknown" if absent (e.g. direct local requests). */
export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

function pruneExpired(now: number): void {
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key)
  }
}
