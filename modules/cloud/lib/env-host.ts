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
 * The service TYPE served at the env apex (`<subdomain>.vetra.io`). Explicit
 * `apexService` wins; otherwise a lone enabled service auto-claims the apex (so a
 * single-CLINT Studio gets the bare subdomain). Null when ambiguous.
 */
export function effectiveApexType(
  services: ServiceLike[],
  apexService: string | null | undefined,
): string | null {
  if (apexService) return apexService
  const enabled = services.filter((s) => s.enabled)
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
