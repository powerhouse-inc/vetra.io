import { ConsoleScope } from '../components/console-scope'
import { StudioPage } from './studio-page'

/** Studio page wrapped in the console scope: the `/studio` route and the logged-out studio gate. */
export function StudioLanding() {
  return (
    <ConsoleScope>
      <StudioPage />
    </ConsoleScope>
  )
}
