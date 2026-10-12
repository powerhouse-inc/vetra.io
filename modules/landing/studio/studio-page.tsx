import { StudioAccess } from './studio-access'
import { StudioControl } from './studio-control'
import { StudioFlow } from './studio-flow'
import { StudioHero } from './studio-hero'
import { StudioHibernation } from './studio-hibernation'
import { StudioOutputs } from './studio-outputs'
import { StudioSessionWindow } from './studio-session-window'

/** Public Vetra Studio page in the console look. Render inside `ConsoleScope`. */
export function StudioPage() {
  return (
    <>
      <StudioHero />
      <StudioSessionWindow />
      <StudioFlow />
      <StudioOutputs />
      <StudioHibernation />
      <StudioControl />
      <StudioAccess />
    </>
  )
}
