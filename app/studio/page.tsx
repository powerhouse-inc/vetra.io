import { StudioLanding } from '@/modules/landing/studio/studio-landing'

export const metadata = {
  title: 'Vetra Studio | A studio of your own, with an agent that builds alongside you',
  description:
    'Vetra Studio turns a conversation into a working Powerhouse package: document models, editors, APIs and tests. Early access, pre-alpha.',
}

/** Public Studio landing. Signed-in users open their studio at `/user/studio`. */
export default function StudioLandingPage() {
  return <StudioLanding />
}
