/**
 * Central registry of OpenPanel custom event names.
 *
 * Convention (ported from Connect): lowercase, dot-namespaced
 * `vetra.<area>.<action>`. Call sites reference these constants so event names
 * are never hand-typed and stay consistent across the app.
 *
 * Automatic pageviews are tracked by `<OpenPanelComponent trackScreenViews />`
 * — these events are for user *actions*, not navigation.
 */
export const EVENTS = {
  // Auth
  authLoginClick: 'vetra.auth.login_click',
  authLogoutClick: 'vetra.auth.logout_click',

  // Marketing / CTA
  ctaTryBetaClick: 'vetra.cta.try_beta_click',

  // Packages
  packageView: 'vetra.package.view',
  packageInstallClick: 'vetra.package.install_click',

  // Cloud
  cloudProjectCreate: 'vetra.cloud.project_create',
  cloudDeploy: 'vetra.cloud.deploy',

  // Builders
  builderProfileView: 'vetra.builder.profile_view',
} as const

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS]
