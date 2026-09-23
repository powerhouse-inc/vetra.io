'use client'

import { useCallback } from 'react'

import type { AddonControl } from '../lib/addons'
import type { CloudEnvironmentService } from '../types'

type Params = {
  services: CloudEnvironmentService[] | undefined
  type: 'DOCLING' | 'PAPERLESS'
  prefix: string
  enableService: (type: 'DOCLING' | 'PAPERLESS', prefix: string) => Promise<void>
  disableService: (type: 'DOCLING' | 'PAPERLESS', prefix: string) => Promise<void>
}

// An add-on that is a plain on/off service in the env document: no version,
// no size, no ingress.
export function useServiceAddon({
  services,
  type,
  prefix,
  enableService,
  disableService,
}: Params): AddonControl {
  const enabled = services?.find((s) => s.type === type)?.enabled ?? false

  const toggle = useCallback(
    async (next: boolean) => {
      if (next) await enableService(type, prefix)
      else await disableService(type, prefix)
    },
    [type, prefix, enableService, disableService],
  )

  return { enabled, toggle }
}
