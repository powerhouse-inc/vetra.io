// Mirrors vetra-cloud-package's getTenantId() (processors/vetra-cloud-environment/
// gitops.ts): the id is the tenant namespace (RFC 1123), so newer mixed-case
// document ids are lowercased and anything but letters and digits ("-", "_")
// is dropped.
export function getTenantId(subdomain: string, documentId: string): string {
  const shortId = documentId
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toLowerCase()
  return `${subdomain}-${shortId}`
}
