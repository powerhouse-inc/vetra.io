/**
 * Reads a runtime env var, preferring the Docker runtime-injected
 * `window.__ENV` (set by the inline script in `app/layout.tsx`) over the
 * build-time `process.env`. Mirrors the `readEnv` helpers in
 * `modules/cloud/client.ts` / `modules/cloud/graphql.ts`.
 *
 * Reading through `window.__ENV` keeps the OpenPanel client ID
 * runtime-configurable: a single Docker image can target different OpenPanel
 * projects per environment without a rebuild.
 */
function readEnv(key: string): string {
  if (typeof window !== 'undefined') {
    const windowEnv = (window as unknown as { __ENV?: Record<string, string> }).__ENV
    if (windowEnv?.[key]) return windowEnv[key]
  }
  return process.env[key] ?? ''
}

/**
 * The OpenPanel client ID. An empty string means analytics is disabled — the
 * SDK is never initialized (see `AnalyticsProvider`). This mirrors Connect's
 * empty-clientId kill switch.
 */
export function getOpenPanelClientId(): string {
  return readEnv('NEXT_PUBLIC_OPENPANEL_CLIENT_ID')
}

/**
 * Optional self-hosted OpenPanel API URL. Returns `undefined` when unset so it
 * can be spread into the SDK options without overriding the cloud default.
 */
export function getOpenPanelApiUrl(): string | undefined {
  return readEnv('NEXT_PUBLIC_OPENPANEL_API_URL') || undefined
}
