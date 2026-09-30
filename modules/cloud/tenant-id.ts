// Mirrors vetra-cloud-package's getTenantId(): lowercased because the id is the
// tenant namespace (RFC 1123) and newer document ids are mixed-case.
export function getTenantId(subdomain: string, documentId: string): string {
  const shortId = documentId.replace(/-/g, '').slice(0, 8).toLowerCase()
  return `${subdomain}-${shortId}`
}
