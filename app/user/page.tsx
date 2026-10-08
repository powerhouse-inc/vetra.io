import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { AppsHome } from './apps-home'

/** Logged-in home: apps, standalone environments, Studio. Creating an app is gated on its own page. */
export default function UserHomePage() {
  return (
    <RequireLogin>
      <AppsHome />
    </RequireLogin>
  )
}
