'use client'

import { useCallback } from 'react'

import type { AddonControl } from '../lib/addons'
import type { CloudEnvironmentService } from '../types'

type ServiceAddonType = 'DOCLING' | 'PAPERLESS' | 'SPECKLE'

type Params = {
  services: CloudEnvironmentService[] | undefined
  type: ServiceAddonType
  prefix: string
  enableService: (type: ServiceAddonType, prefix: string) => Promise<void>
  disableService: (type: ServiceAddonType, prefix: string) => Promise<void>
  /** The add-on's web UI, for add-ons that serve one. */
  href?: string
  hrefLabel?: string
  hrefHint?: string
}

// An add-on that is a plain on/off service in the env document: no version,
// no size, and at most its own fixed host (href).
export function useServiceAddon({
  services,
  type,
  prefix,
  enableService,
  disableService,
  href,
  hrefLabel,
  hrefHint,
}: Params): AddonControl {
  const enabled = services?.find((s) => s.type === type)?.enabled ?? false

  const toggle = useCallback(
    async (next: boolean) => {
      if (next) await enableService(type, prefix)
      else await disableService(type, prefix)
    },
    [type, prefix, enableService, disableService],
  )

  return { enabled, toggle, href, hrefLabel, hrefHint }
}
