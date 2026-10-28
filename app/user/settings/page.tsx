'use client'
import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { Plus, Settings, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback } from 'react'
import { SettingsTab } from '@/app/profile/components/settings-tab'
import { TeamsTab } from '@/app/profile/components/teams-tab'
import { PageHeader } from '@/modules/shared/components/page-header'
import { PageSpinner } from '@/modules/shared/components/page-shell'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { Button } from '@/modules/shared/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/modules/shared/components/ui/tabs'

const VALID_TABS = ['profile', 'teams'] as const
type SettingsTab_ = (typeof VALID_TABS)[number]

function isValidTab(v: string | null): v is SettingsTab_ {
  return v !== null && (VALID_TABS as readonly string[]).includes(v)
}

function UserSettingsPageInner() {
  const auth = useRenownAuthAsync()
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

  // RequireLogin gates the page; the address can trail the auth state by a render.
  if (!auth.address) return <PageSpinner />

  return (
    <div className="container mx-auto max-w-5xl px-4 pt-20 pb-8">
      <PageHeader
        eyebrow="~/settings"
        className="mb-8"
        title="Profile settings"
        description="Your Renown identity, account details, and teams."
        actions={
          active === 'teams' && (
            <Button asChild>
              <Link href="/profile/create-team">
                <Plus className="size-4" />
                Create team
              </Link>
            </Button>
          )
        }
      />

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
    <RequireLogin title="Log in to manage your settings">
      <Suspense fallback={<PageSpinner />}>
        <UserSettingsPageInner />
      </Suspense>
    </RequireLogin>
  )
}
