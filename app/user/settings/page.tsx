'use client'
import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { Loader2, Plus, Settings, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback } from 'react'
import { LoginPrompt } from '@/app/profile/components/login-prompt'
import { SettingsTab } from '@/app/profile/components/settings-tab'
import { TeamsTab } from '@/app/profile/components/teams-tab'
import { Button } from '@/modules/shared/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/modules/shared/components/ui/tabs'

const VALID_TABS = ['profile', 'teams'] as const
type SettingsTab_ = (typeof VALID_TABS)[number]

function isValidTab(v: string | null): v is SettingsTab_ {
  return v !== null && (VALID_TABS as readonly string[]).includes(v)
}

function UserSettingsPageInner() {
  const auth = useRenownAuth()
  const router = useRouter()
  const params = useSearchParams()
  const rawTab = params.get('tab')
  const active: SettingsTab_ = isValidTab(rawTab) ? rawTab : 'profile'

  const onChange = useCallback(
    (next: string) => {
      const sp = new URLSearchParams(params.toString())
      sp.set('tab', next)
      router.replace(`/user/settings?${sp.toString()}`, { scroll: false })
    },
    [params, router],
  )

  if (auth.status === 'loading' || auth.status === 'checking') {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (auth.status !== 'authorized' || !auth.address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoginPrompt onLogin={auth.login} />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 pt-20 pb-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your Renown identity, account details, and teams.
          </p>
        </div>
        {active === 'teams' && (
          <Button asChild>
            <Link href="/profile/create-team">
              <Plus className="mr-1.5 size-4" />
              Create team
            </Link>
          </Button>
        )}
      </div>

      <Tabs value={active} onValueChange={onChange} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="profile" className="gap-1.5">
            <Settings className="size-4" /> Profile settings
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5">
            <Users className="size-4" /> Teams
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="teams">
          <TeamsTab address={auth.address} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function UserSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      }
    >
      <UserSettingsPageInner />
    </Suspense>
  )
}
