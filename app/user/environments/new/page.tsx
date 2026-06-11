'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { NewEnvironmentForm } from '@/app/user/environments/new-project-form'

export default function CreateEnvironmentPage() {
  const router = useRouter()

  return (
    <main className="mx-auto mt-20 max-w-lg px-6 py-8">
      <Link
        href="/user/environments"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Cloud
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Create Environment</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Set up a new cloud environment to host your Powerhouse applications.
      </p>
      <NewEnvironmentForm onCreated={(id) => router.push(`/user/environments/${id}`)} />
    </main>
  )
}
