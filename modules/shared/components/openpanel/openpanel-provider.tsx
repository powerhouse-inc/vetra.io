'use client'

import { OpenPanelComponent } from '@openpanel/nextjs'

interface OpenPanelProviderProps {
  /**
   * Public clientId for the OpenPanel project. When undefined the component
   * renders nothing, so local dev and CI without an OpenPanel deployment
   * skip the SDK entirely.
   */
  clientId?: string
  /**
   * Base URL of the self-hosted OpenPanel API (e.g.
   * `https://openpanel.monitoring.vetra.io/api`). Omit to fall back to the
   * managed OpenPanel cloud.
   */
  apiUrl?: string
  /**
   * Stamped on every event as a `environment` global property so a single
   * project can host staging + prod traffic and segment in the dashboard.
   */
  environment?: string
}

export function OpenPanelProvider({ clientId, apiUrl, environment }: OpenPanelProviderProps) {
  if (!clientId) {
    return null
  }

  return (
    <OpenPanelComponent
      clientId={clientId}
      apiUrl={apiUrl}
      trackScreenViews
      trackOutgoingLinks
      trackAttributes
      globalProperties={environment ? { environment } : undefined}
    />
  )
}
