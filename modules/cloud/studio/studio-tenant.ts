/** Mirrors the gitops processor: `<subdomain>-<first 8 hex of doc id>`. */
export function deriveTenantId(subdomain: string, documentId: string): string {
  const shortId = documentId.replace(/-/g, '').slice(0, 8)
  return `${subdomain}-${shortId}`
}
