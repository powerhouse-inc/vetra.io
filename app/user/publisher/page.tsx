import { redirect } from 'next/navigation'

type Props = { searchParams: Promise<{ app?: string | string[] }> }

/**
 * The old Licensing dashboard. Licensing now lives on each app's page, so an
 * old bookmark with ?app=<id> lands on that app's Plans tab and anything else
 * on the apps home.
 */
export default async function PublisherRedirect({ searchParams }: Props) {
  const { app } = await searchParams
  const id = Array.isArray(app) ? app[0] : app
  redirect(id ? `/user/apps/${encodeURIComponent(id)}?tab=plans` : '/user')
}
