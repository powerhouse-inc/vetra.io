'use client'
import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { Building2, Settings } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback } from 'react'
import { SettingsTab } from '@/app/profile/components/settings-tab'
import { PageHeader } from '@/modules/shared/components/page-header'
import { PageSpinner } from '@/modules/shared/components/page-shell'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/modules/shared/components/ui/tabs'
import { useDocumentTitle } from '@/modules/shared/hooks/use-document-title'
import { CreateOrgButton, OrgsTab } from './orgs-tab'

const VALID_TABS = ['profile', 'organisations'] as const
type SettingsTab_ = (typeof VALID_TABS)[number]

function isValidTab(v: string | null): v is SettingsTab_ {
  return v !== null && (VALID_TABS as readonly string[]).includes(v)
}

function UserSettingsPageInner() {
  useDocumentTitle('Settings')
  const auth = useRenownAuthAsync()
  const router = useRouter()
  const params = useSearchParams()
  // ?tab=teams predates Renown organisations; old links land on the new tab.
  const rawTab = params.get('tab') === 'teams' ? 'organisations' : params.get('tab')
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
    <div className="mx-auto max-w-screen-xl px-6 pt-20 pb-16">
      <PageHeader
        eyebrow="~/settings"
        className="mb-8"
        title="Profile settings"
        description="Your Renown identity, account details, and organisations."
        actions={active === 'organisations' && <CreateOrgButton />}
      />

      <Tabs value={active} onValueChange={onChange} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="profile" className="gap-1.5">
            <Settings className="size-4" /> Profile settings
          </TabsTrigger>
          <TabsTrigger value="organisations" className="gap-1.5">
            <Building2 className="size-4" /> Organisations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="organisations">
          <OrgsTab />
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
