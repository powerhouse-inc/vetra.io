import { redirect } from 'next/navigation'

/** The Studio grid moved to /user/studio; keep old links working. */
export default function UserProductsPage() {
  redirect('/user/studio')
}
