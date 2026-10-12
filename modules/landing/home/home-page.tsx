import { HomeCapabilities } from './home-capabilities'
import { HomeFinalCta } from './home-final-cta'
import { HomeHero } from './home-hero'
import { HomeProductWindow } from './home-product-window'
import { HomeRepoDeploy } from './home-repo-deploy'

/** Public home page in the console look. Render inside `ConsoleScope`. */
export function HomePage() {
  return (
    <>
      <HomeHero />
      <HomeProductWindow />
      <HomeCapabilities />
      <HomeRepoDeploy />
      <HomeFinalCta />
    </>
  )
}
