import { ConsoleScope } from '../components/console-scope'
import { CloudPage } from './cloud-page'

/** Cloud page wrapped in the console scope, as served at `/cloud`. */
export function CloudLanding() {
  return (
    <ConsoleScope>
      <CloudPage />
    </ConsoleScope>
  )
}
