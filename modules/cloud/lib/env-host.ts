// Flattened single-label env hosts — MIRRORS the gitops processor
// (vetra-cloud-package processors/vetra-cloud-environment/gitops.ts:
// resolveGenericHost / effectiveApexType / isTypeAtApex). Every generic
// `.vetra.io` env host is a single DNS label so it's covered by the cluster
// `*.vetra.io` wildcard cert. Keep this in sync with the processor.

export type ServiceLike = { type: string; enabled: boolean; prefix?: string | null }

/**
 * A service's generic ingress host as a single label:
 *   apex  -> `<subdomain>.<base>`           (e.g. tall-duck-ab12.vetra.io)
 *   other -> `<subdomain>-<prefix>.<base>`  (e.g. tall-duck-ab12-connect.vetra.io)
 */
export function resolveGenericHost(
  subdomain: string,
  prefix: string,
  isApex: boolean,
  baseDomain: string,
): string {
  return isApex ? `${subdomain}.${baseDomain}` : `${subdomain}-${prefix}.${baseDomain}`
}

/**
 * Service types that render an Ingress and can therefore own the apex —
 * MIRRORS vetra-cloud-package shared/apex.ts APEX_CAPABLE_TYPES. Add-ons such
 * as DOCLING / PAPERLESS have no ingress and must not count, or switching one
 * on would "move" a lone service off the bare subdomain in the UI only.
 */
export const APEX_CAPABLE_TYPES: readonly string[] = ['CONNECT', 'SWITCHBOARD', 'FUSION', 'CLINT']

export function isApexCapable(type: string | null | undefined): boolean {
  return !!type && APEX_CAPABLE_TYPES.includes(type)
}

/**
 * The service TYPE served at the env apex (`<subdomain>.vetra.io`). Explicit
 * `apexService` wins; otherwise a lone enabled ROUTABLE service auto-claims the
 * apex (so a single-CLINT Studio gets the bare subdomain). Null when ambiguous.
 */
export function effectiveApexType(
  services: ServiceLike[],
  apexService: string | null | undefined,
): string | null {
  if (apexService) return apexService
  const enabled = services.filter((s) => s.enabled && isApexCapable(s.type))
  return enabled.length === 1 ? enabled[0].type : null
}

/**
 * Whether a service type sits at the apex. The bare apex host belongs to only
 * one service, so the type must have exactly one enabled instance.
 */
export function isTypeAtApex(
  services: ServiceLike[],
  apexService: string | null | undefined,
  type: string,
): boolean {
  if (effectiveApexType(services, apexService) !== type) return false
  return services.filter((s) => s.enabled && s.type === type).length === 1
}

// ---------------------------------------------------------------------------
// Custom domains — MIRRORS gitops.ts (readApexService / generateCustomDomainIngress).
// Unlike the generic apex there is NO lone-service auto-claim: the bare custom
// domain belongs to a service only when `apexService` pins it; otherwise the
// chart renders `connect.<domain>` / `switchboard.<domain>` (fixed prefixes, not
// the service's own prefix). No other type gets a custom-domain ingress.
// ---------------------------------------------------------------------------

const CUSTOM_DOMAIN_PREFIX: Record<string, string> = {
  CONNECT: 'connect',
  SWITCHBOARD: 'switchboard',
}

function isEnabled(services: ServiceLike[], type: string): boolean {
  return services.some((s) => s.enabled && s.type === type)
}

/** Whether `type` is served at the bare custom domain (explicitly pinned). */
export function isPinnedToCustomApex(
  services: ServiceLike[],
  apexService: string | null | undefined,
  customDomain: string | null | undefined,
  type: string,
): boolean {
  return (
    !!customDomain &&
    apexService === type &&
    type in CUSTOM_DOMAIN_PREFIX &&
    isEnabled(services, type)
  )
}

/** The host a service answers on under the custom domain, or null if none. */
export function customDomainServiceHost(
  services: ServiceLike[],
  apexService: string | null | undefined,
  customDomain: string | null | undefined,
  type: string,
): string | null {
  if (!customDomain || !(type in CUSTOM_DOMAIN_PREFIX) || !isEnabled(services, type)) return null
  if (isPinnedToCustomApex(services, apexService, customDomain, type)) return customDomain
  return `${CUSTOM_DOMAIN_PREFIX[type]}.${customDomain}`
}

/**
 * The single host that represents the whole env, for the page header: the
 * custom domain when a service is pinned to it, else the generic apex when a
 * service owns it, else null — with several services and no pin there is no
 * bare host, and showing one would advertise an address that 404s.
 */
export function envHeaderHost(env: {
  subdomain: string
  baseDomain: string
  services: ServiceLike[]
  apexService: string | null | undefined
  customDomain?: string | null
}): string | null {
  const pinned = env.services.find((s) =>
    isPinnedToCustomApex(env.services, env.apexService, env.customDomain, s.type),
  )
  if (pinned && env.customDomain) return env.customDomain
  const apexType = effectiveApexType(env.services, env.apexService)
  if (apexType && isTypeAtApex(env.services, env.apexService, apexType)) {
    return `${env.subdomain}.${env.baseDomain}`
  }
  return null
}
