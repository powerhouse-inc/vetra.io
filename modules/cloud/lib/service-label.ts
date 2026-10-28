import type { CloudEnvironmentServiceType } from '../types'

const LABELS: Record<CloudEnvironmentServiceType, string> = {
  CONNECT: 'Connect',
  SWITCHBOARD: 'Switchboard',
  FUSION: 'Fusion',
  CLINT: 'Agent',
  DOCLING: 'Document Conversion',
  PAPERLESS: 'Document Archive',
  SPECKLE: '3D Models',
}

/**
 * Service types that answer on a host a user can open in the browser.
 * Document Conversion and Document Archive have no ingress.
 */
const VISITABLE_TYPES: ReadonlySet<string> = new Set([
  'CONNECT',
  'SWITCHBOARD',
  'FUSION',
  'CLINT',
  'SPECKLE',
])

/** Short user-facing name for one service instance; agents carry their prefix. */
export function serviceInstanceLabel(svc: { type: string; prefix?: string | null }): string {
  const base = LABELS[svc.type as CloudEnvironmentServiceType] ?? svc.type
  return svc.type === 'CLINT' && svc.prefix ? `${base}: ${svc.prefix}` : base
}

/** Whether a service has a host worth linking to from a "Visit" menu. */
export function isVisitableService(svc: { type: string }): boolean {
  return VISITABLE_TYPES.has(svc.type)
}

/** Stable React key for a service instance (several agents share a type). */
export function serviceInstanceKey(svc: { type: string; prefix?: string | null }): string {
  return `${svc.type}:${svc.prefix ?? ''}`
}
