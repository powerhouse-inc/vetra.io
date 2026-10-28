import { CloudLanding } from '@/modules/landing/cloud/cloud-landing'

export const metadata = {
  title: { absolute: 'Vetra Cloud · Managed hosting for Powerhouse apps' },
  description:
    'Environments with a team workspace, APIs and agents, your own domain and nightly backups. Priced by capacity from €40 per month, with self-hosting always an option.',
}

/**
 * Public Vetra Cloud landing page. Always renders the marketing landing —
 * including for signed-in users — so `/cloud` is a stable, shareable page.
 * (Signed-in users reach their environments via the nav at `/user/environments`.)
 */
export default function CloudLandingPage() {
  return <CloudLanding />
}
