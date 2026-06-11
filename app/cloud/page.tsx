import { CloudLanding } from '@/modules/cloud/components/cloud-landing'

/**
 * Public Vetra Cloud landing page. Always renders the marketing landing —
 * including for signed-in users — so `/cloud` is a stable, shareable page.
 * (Signed-in users reach their environments via the nav at `/user/environments`.)
 */
export default function CloudLandingPage() {
  return <CloudLanding />
}
