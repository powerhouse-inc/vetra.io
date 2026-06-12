'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Users, Package, Settings } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/modules/shared/components/ui/tabs'
import { TeamsTab } from './teams-tab'
import { PackagesTab } from './packages-tab'
import { SettingsTab } from './settings-tab'

const VALID_TABS = ['packages', 'teams', 'settings'] as const
type ProfileTab = (typeof VALID_TABS)[number]

function isValidTab(v: string | null): v is ProfileTab {
  return v !== null && (VALID_TABS as readonly string[]).includes(v)
}

interface ProfileTabsProps {
  address: string
  basePath?: string
  showSettings?: boolean
}

export function ProfileTabs({
  address,
  basePath = '/profile',
  showSettings = true,
}: ProfileTabsProps) {
  const router = useRouter()
  const params = useSearchParams()
  const rawTab = params.get('tab')
  const active: ProfileTab = isValidTab(rawTab) ? rawTab : 'packages'

  const onChange = useCallback(
    (next: string) => {
      const sp = new URLSearchParams(params.toString())
      sp.set('tab', next)
      router.replace(`${basePath}?${sp.toString()}`, { scroll: false })
    },
    [params, router, basePath],
  )

  return (
    <Tabs value={active} onValueChange={onChange} className="w-full">
      <TabsList
        className={`mb-6 grid w-full ${showSettings ? 'grid-cols-3' : 'grid-cols-2'} sm:inline-flex sm:w-auto`}
      >
        <TabsTrigger value="packages" className="gap-1.5">
          <Package className="size-4" /> Packages
        </TabsTrigger>
        <TabsTrigger value="teams" className="gap-1.5">
          <Users className="size-4" /> Teams
        </TabsTrigger>
        {showSettings && (
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="size-4" /> Profile settings
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="packages">
        <PackagesTab />
      </TabsContent>
      <TabsContent value="teams">
        <TeamsTab address={address} />
      </TabsContent>
      {showSettings && (
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      )}
    </Tabs>
  )
}
