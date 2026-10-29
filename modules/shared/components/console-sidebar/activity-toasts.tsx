'use client'

import { useEnvironmentTransitionToasts } from '@/modules/cloud/hooks/use-environment-activity'

/** Mounted once in the console shell: toasts deploys, syncs and terminations as they finish. */
export function ActivityToasts() {
  useEnvironmentTransitionToasts()
  return null
}
