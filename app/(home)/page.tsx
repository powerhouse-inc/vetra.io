import { ConsoleScope } from '@/modules/landing/components/console-scope'
import { HomePage as ConsoleHome } from '@/modules/landing/home/home-page'
import { verifySession } from '@/modules/shared/lib/renown-session'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Vetra | An agent that builds Powerhouse apps, a cloud that hosts them',
  description:
    'Vetra Studio turns a conversation into an open-source Powerhouse package. Vetra Cloud hosts it, or you self-host it on the open Powerhouse platform.',
}

export default async function HomePage() {
  // Signed-in visitors go straight to their dashboard (was HomeAuthedRedirect).
  const session = await verifySession()
  if (session) redirect('/user')

  return (
    <ConsoleScope>
      <ConsoleHome />
    </ConsoleScope>
  )
}
