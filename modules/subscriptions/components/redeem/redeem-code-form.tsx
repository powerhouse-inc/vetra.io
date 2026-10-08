'use client'

import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { redeemPath } from '@/modules/publisher/lib/invite-codes'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'

export function RedeemCodeForm({ initial = '' }: { initial?: string }) {
  const router = useRouter()
  const [code, setCode] = useState(initial)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed) router.push(redeemPath(trimmed))
  }
  return (
    <form
      onSubmit={submit}
      aria-label="Redeem an invite code"
      className="flex flex-col gap-2 sm:flex-row"
    >
      <Input
        aria-label="Invite code"
        placeholder="Enter your code"
        className="h-11 font-mono text-base"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <Button type="submit" size="lg" className="h-11">
        Continue
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  )
}
