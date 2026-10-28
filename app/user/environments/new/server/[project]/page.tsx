import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ project: string }>
  searchParams: Promise<{ addPackage?: string | string[]; version?: string | string[] }>
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/**
 * The old standalone "Add package" form, replaced by the Add package modal on the
 * environment page. Keep old links working: land on the environment, and open the
 * modal when a package was named (`?addPackage=<name>` prefills it there).
 */
export default async function AddPackageRedirect({ params, searchParams }: Props) {
  const { project } = await params
  const query = await searchParams
  const pkg = first(query.addPackage)
  const version = first(query.version)
  const qs = new URLSearchParams()
  if (pkg) qs.set('addPackage', pkg)
  if (pkg && version) qs.set('version', version)
  const suffix = qs.size > 0 ? `?${qs.toString()}` : ''
  redirect(`/user/environments/${encodeURIComponent(project)}${suffix}`)
}
