'use client'

import { OpenPanelComponent } from '@openpanel/nextjs'
import { OPENPANEL_FILTER_JS } from '@/modules/shared/lib/analytics-privacy'

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
      // Hides invite codes in /redeem/<code> paths and referrers before anything is sent.
      filter={OPENPANEL_FILTER_JS}
      globalProperties={environment ? { environment } : undefined}
    />
  )
}
