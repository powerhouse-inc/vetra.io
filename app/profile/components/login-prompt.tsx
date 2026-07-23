'use client'
import { LogIn } from 'lucide-react'
import { useOpenLogin } from '@/modules/shared/components/renown/login-modal-context'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'

export function LoginPrompt() {
  const openLogin = useOpenLogin()
  return (
    <Card className="mx-auto mt-12 max-w-md">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="bg-primary/10 flex size-12 items-center justify-center rounded-full">
          <LogIn className="text-primary size-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Sign in to view your profile</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect with Renown to see the builder teams you&apos;re a member of and the packages
            you&apos;ve published.
          </p>
        </div>
        <Button onClick={openLogin} className="w-full">
          <LogIn className="mr-2 size-4" />
          Sign in with Renown
        </Button>
      </CardContent>
    </Card>
  )
}
