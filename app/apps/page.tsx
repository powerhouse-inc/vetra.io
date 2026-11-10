import type { Metadata } from 'next'
import { PageHeader } from '@/modules/shared/components/page-header'
import { PageShell } from '@/modules/shared/components/page-shell'
import { AppsList } from './components/apps-list'
import { loadAppsDirectory } from './lib/directory'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Apps',
  description: 'Apps built on Vetra, most used first.',
}

export default async function AppsPage() {
  const apps = await loadAppsDirectory().catch(() => null)

  return (
    <PageShell>
      <PageHeader
        eyebrow="~/apps"
        title="Apps"
        description="Apps built on Vetra, most used first: ranked by how many people hold one."
      />
      {apps ? (
        <AppsList apps={apps} />
      ) : (
        <p className="text-muted-foreground mt-10 text-sm">
          The app directory did not answer. Try again in a minute.
        </p>
      )}
    </PageShell>
  )
}
