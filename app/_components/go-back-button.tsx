'use client'

import { useRouter } from 'next/navigation'

export function GoBackButton({ className }: { className?: string }) {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.back()} className={className}>
      Go Back
    </button>
  )
}
