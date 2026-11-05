import { getTenantId } from '../tenant-id'

/** Mirrors the gitops processor: `<subdomain>-<first 8 alphanumerics of doc id>`. */
export function deriveTenantId(subdomain: string, documentId: string): string {
  return getTenantId(subdomain, documentId)
}
