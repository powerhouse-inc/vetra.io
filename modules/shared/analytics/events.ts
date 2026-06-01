/**
 * Central registry of OpenPanel custom event names.
 *
 * Convention: lowercase, fully dot-namespaced `<area>.<action>` (no
 * underscores). Events are NOT app-prefixed — every event is stamped with the
 * {@link ANALYTICS_APP} global property instead (set once on the OpenPanel
 * mount), so Vetra's events are distinguishable from sibling Powerhouse
 * products (e.g. Renown) in the shared dashboard. This matches Renown's
 * analytics taxonomy so the two apps stay consistent.
 *
 * Call sites reference these constants so event names are never hand-typed and
 * stay consistent across the app.
 *
 * Automatic pageviews are tracked by `<OpenPanelComponent trackScreenViews />`
 * — these events are for user *actions*, not navigation.
 */
export const ANALYTICS_APP = 'vetra'

export const EVENTS = {
  // Auth
  authLoginClick: 'auth.login.click',
  authLogoutClick: 'auth.logout.click',

  // Marketing / CTA
  ctaTryBetaClick: 'cta.try.beta.click',

  // Packages
  packageView: 'package.view',
  packageInstallClick: 'package.install.click',

  // Cloud
  cloudProjectCreate: 'cloud.project.create',
  cloudDeploy: 'cloud.deploy',

  // Builders
  builderProfileView: 'builder.profile.view',
} as const

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS]
