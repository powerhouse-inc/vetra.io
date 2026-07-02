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
