function readEnv(key: string): string {
  if (typeof window !== 'undefined') {
    const windowEnv = (window as unknown as { __ENV?: Record<string, string> }).__ENV
    if (windowEnv?.[key]) return windowEnv[key]
  }
  return process.env[key] ?? ''
}

/** The cloud switchboard GraphQL URL. */
export function cloudSwitchboardUrl(): string {
  return (
    readEnv('NEXT_PUBLIC_CLOUD_SWITCHBOARD_URL') ||
    readEnv('NEXT_PUBLIC_SWITCHBOARD_URL') ||
    'https://switchboard.vetra.io/graphql'
  )
}

/**
 * Package registry a newly-created Vetra Studio publishes/installs against.
 * Per-deployment via NEXT_PUBLIC_STUDIO_REGISTRY (prod → registry.vetra.io,
 * staging → the dev registry). Read at call time (runtime __ENV), defaulting
 * to the dev registry so staging/local behaviour is unchanged when unset.
 */
export function studioRegistry(): string {
  return readEnv('NEXT_PUBLIC_STUDIO_REGISTRY') || 'https://registry.dev.vetra.io'
}
