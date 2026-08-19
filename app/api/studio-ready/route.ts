export const dynamic = 'force-dynamic'

/** Apex studio host, e.g. tall-duck-ab12cd34.vetra.io. */
const HOST_RE = /^[a-z0-9-]+\.vetra\.io$/

/**
 * Server-side readiness probe for a freshly-woken studio.
 *
 * The /studio/waking page is cross-origin to the studio host, so the browser
 * cannot read the studio's real HTTP status (no-cors responses are opaque).
 * This same-origin route probes the studio's `/` from the server instead: a
 * route-ready studio redirects `/` → `/d/<driveId>` (302), while a woken-but-
 * not-yet-ready agent returns 404 "Not Found" until it mounts its routes. The
 * waking page polls this and only redirects the user once the app truly serves.
 */
export async function GET(req: Request): Promise<Response> {
  const host = new URL(req.url).searchParams.get('host') ?? ''
  if (!HOST_RE.test(host)) {
    return Response.json({ ready: false, reason: 'invalid-host' }, { status: 400 })
  }
  try {
    const res = await fetch(`https://${host}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
      headers: { 'user-agent': 'vetra-waking-readiness' },
    })
    const loc = res.headers.get('location') ?? ''
    // This route is polled by /studio/waking and only needs status + headers.
    // Release the response body so undici doesn't retain the socket + buffered
    // body across requests (an unconsumed fetch body is a server-heap leak).
    void res.body?.cancel()
    // Ready = the app is actually serving: a 2xx, or a redirect into the app
    // (`/d/<driveId>`). NOT ready = transient 404 / 5xx, or the wake activator's
    // bounce to the bare host root (which means the studio isn't serving yet).
    const ready =
      (res.status >= 200 && res.status < 300) ||
      (res.status >= 300 && res.status < 400 && loc.includes('/d/'))
    return Response.json(
      { ready, status: res.status },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch {
    // Connection refused / TLS / timeout — agent not serving yet.
    return Response.json({ ready: false, status: 0 }, { headers: { 'cache-control': 'no-store' } })
  }
}
