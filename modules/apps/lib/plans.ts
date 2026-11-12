import type { AppInstance, AppPlan, AppPlanAccess, AppPlanSize, AppRelease } from '../types'

export const ACCESS_LABEL: Record<AppPlanAccess, string> = {
  shared: 'Shared',
  own: 'Own',
}

export const ACCESS_HINT: Record<AppPlanAccess, string> = {
  shared: 'One instance everyone with this plan uses.',
  own: 'Every holder gets their own instance.',
}

/** `VETRA_AGENT_XL` → `XL`. */
export function sizeLabel(size: string): string {
  return size.replace(/^VETRA_AGENT_/, '')
}

/** The plan that adopted the licensing term `kind`, if any (a term becomes a plan once). */
export function planForKind(plans: AppPlan[] | undefined, kind: string): AppPlan | undefined {
  return plans?.find((p) => p.kind === kind)
}

/** Versions a plan may target: the App's releases, never its builds; newest first as given. */
export function releaseVersions(releases: AppRelease[] | undefined): string[] {
  return (releases ?? []).filter((r) => r.kind === 'release').map((r) => r.version)
}

export function planInstances(instances: AppInstance[] | undefined, planId: string): AppInstance[] {
  return (instances ?? []).filter((i) => i.planId === planId)
}

export function instanceCountText(n: number): string {
  return n === 1 ? '1 instance' : `${n} instances`
}

export const isPlanSize = (v: string): v is AppPlanSize => /^VETRA_AGENT_(S|M|L|XL|XXL)$/.test(v)
