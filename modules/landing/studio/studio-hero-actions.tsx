'use client'

import { useStudioAccess } from '@/modules/subscriptions/hooks/use-subscriptions'
import { CtaLink } from '../components/cta-link'
import { EARLY_ACCESS_HREF, REDEEM_HREF } from '../lib/links'

/** Hero buttons: someone who already has Studio is sent to it, not asked to request access. */
export function StudioHeroActions() {
  const { data } = useStudioAccess()
  if (data?.allowed) {
    return (
      <div className="flex flex-wrap gap-3">
        <CtaLink href="/user/studio" variant="primary">
          Open your studio
        </CtaLink>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-3">
      <CtaLink href={EARLY_ACCESS_HREF} variant="primary">
        Request access
      </CtaLink>
      <CtaLink href={REDEEM_HREF}>Redeem a code</CtaLink>
    </div>
  )
}
