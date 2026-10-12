import { CloudCapabilities } from './cloud-capabilities'
import { CloudEnvironmentWindow } from './cloud-environment-window'
import { CloudExit } from './cloud-exit'
import { CloudFinalCta } from './cloud-final-cta'
import { CloudHero } from './cloud-hero'
import { CloudLifecycle } from './cloud-lifecycle'
import { CloudPricing } from './cloud-pricing'
import { CloudSecurity } from './cloud-security'

/** Public Vetra Cloud page in the console look. Render inside `ConsoleScope`. */
export function CloudPage() {
  return (
    <>
      <CloudHero />
      <CloudEnvironmentWindow />
      <CloudLifecycle />
      <CloudCapabilities />
      <CloudPricing />
      <CloudSecurity />
      <CloudExit />
      <CloudFinalCta />
    </>
  )
}
