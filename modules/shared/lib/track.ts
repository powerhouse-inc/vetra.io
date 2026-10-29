/**
 * Named product events for the first-run funnel, sent to OpenPanel.
 *
 * Umami stays page-views only: both Umami scripts share one `window.umami`, so a
 * custom event would reach just one of the two instances.
 *
 * Properties are ids, enums and public package names only. Never pass invite
 * codes, document content or anything a user typed.
 */
type EventProps = {
  signed_in: undefined
  code_redeemed: { mode: string | null }
  env_created: { environmentId: string }
  changes_approved: { environmentId: string }
  package_installed: { environmentId: string; packageName: string }
  release_rolled_back: { environmentId: string }
  studio_app_opened: { environmentId: string; status: string }
}

export type TrackEvent = keyof EventProps

type OpenPanelCall = (method: 'track', name: string, properties?: object) => void

export function track<E extends TrackEvent>(
  event: E,
  ...properties: EventProps[E] extends undefined ? [] : [EventProps[E]]
): void {
  if (typeof window === 'undefined') return
  try {
    // `window.op` only exists when OpenPanelProvider rendered (clientId set).
    ;(window as { op?: OpenPanelCall }).op?.('track', event, properties[0])
  } catch {
    // Analytics must never break the action that triggered it.
  }
}
