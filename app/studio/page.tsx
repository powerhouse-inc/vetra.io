import { redirect } from 'next/navigation'

// Products grid now lives at /user; /studio/[envId] is the embedded studio.
export default function StudioPage() {
  redirect('/user')
}
