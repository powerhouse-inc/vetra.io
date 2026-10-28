import type { Metadata } from 'next'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { AppsHome } from './apps-home'

export const metadata: Metadata = { title: 'Your apps' }

/** Logged-in home: apps, standalone environments, Studio. Creating an app is gated on its own page. */
export default function UserHomePage() {
  return (
    <RequireLogin>
      <AppsHome />
    </RequireLogin>
  )
}
