import { type PackageInfo } from '@powerhousedao/shared'
import { type SearchParams } from 'nuqs/server'
import { Search as SearchIcon } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/modules/shared/components/ui/breadcrumb'
import Link from 'next/link'
import { Button } from '@/modules/shared/components/ui/button'
import { loadSearchParams, packagesShowUrl } from './lib/search-params'
import { recommendedNames } from './lib/recommended'
import { Filters } from './components/filters'
import { MobileFilters } from './components/mobile-filters'
import { fuse, packageModuleTypes, REGISTRY_URL } from './lib/constants'
import { map, unique, filter, isTruthy } from 'remeda'
import { filterEntries, getSearchWords } from './lib/utils'
import { type PackageEntry } from './lib/types'
import { PackageList } from './components/package-list'
import { CreatePackageModal } from './components/create-package-modal'

export const metadata: unknown = {
  title: 'Vetra Packages',
  description:
    'Explore Vetra packages - a collection of document models, editors, and module resources providing solutions for specific domains and industries.',
  openGraph: {
    title: 'Vetra Packages',
    description:
      'Explore Vetra packages - a collection of document models, editors, and module resources providing solutions for specific domains and industries.',
    url: 'https://vetra.to/packages',
    siteName: 'Vetra',
    type: 'website',
    images: [
      {
        url: 'https://vetra.to/vetra-logo.png',
        width: 1200,
        height: 630,
        alt: 'Vetra Packages',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vetra Packages',
    description:
      'Explore Vetra packages - a collection of document models, editors, and module resources providing solutions for specific domains and industries.',
    images: ['https://vetra.to/vetra-logo.png'],
    site: '@vetra',
  },
  alternates: {
    canonical: 'https://vetra.to/packages',
  },
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function PackagesPage({ searchParams }: PageProps) {
  const raw = await searchParams
  const { search, show, ...filters } = await loadSearchParams(searchParams)
  const recommended = recommendedNames()
  const effectiveShow = recommended.size > 0 ? (show ?? 'recommended') : 'all'
  const packagesRes = await fetch(`${REGISTRY_URL}/packages`, {
    next: { revalidate: 30 },
  })
  const allPackages = (await packagesRes.json()) as PackageInfo[]
  const packages =
    effectiveShow === 'recommended'
      ? filter(allPackages, (p) => recommended.has(p.name.toLowerCase()))
      : allPackages
  const entries = filter(
    map(packages, (p) => ({ registryName: p.name, manifest: p.manifest })),
    (e): e is PackageEntry => isTruthy(e.manifest),
  )
  const categoryOptions = unique(
    filter(
      map(entries, (e) => e.manifest.category),
      isTruthy,
    ),
  )
  const publisherNameOptions = unique(
    filter(
      map(entries, (e) => e.manifest.publisher?.name),
      isTruthy,
    ),
  )
  const filteredEntries = filterEntries(entries, filters)
  fuse.setCollection(filteredEntries)

  const searchResult = fuse.search(search ?? '')

  return (
    <div className="container mx-auto mt-20 max-w-screen-xl space-y-8 px-6 py-8">
      {/* Page Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-4xl font-bold">Packages</h1>
          <CreatePackageModal />
        </div>
        <p className="text-foreground-70 max-w-2xl">
          Packages are a collection of document models, editors, and other module resources
          providing solutions for specific domains and industries.
        </p>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/packages">Packages</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Overview</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Mobile Filters Button */}
      <div className="lg:hidden">
        <MobileFilters
          moduleTypeOptions={packageModuleTypes}
          categoryOptions={categoryOptions}
          publisherNameOptions={publisherNameOptions}
        />
      </div>

      {/* Recommended / all view toggle */}
      {recommended.size > 0 && (
        <Button asChild variant="outline" size="sm">
          <Link
            href={packagesShowUrl(effectiveShow === 'recommended' ? 'all' : 'recommended', raw)}
          >
            {effectiveShow === 'recommended' ? 'Show all packages' : 'Show recommended only'}
          </Link>
        </Button>
      )}

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block">
          <div className="bg-card sticky top-24 rounded-xl p-4 shadow-sm">
            <Filters
              moduleTypeOptions={packageModuleTypes}
              categoryOptions={categoryOptions}
              publisherNameOptions={publisherNameOptions}
            />
          </div>
        </aside>

        {/* Package Grid */}
        <div className="lg:col-span-3">
          {searchResult.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-20">
              <SearchIcon className="size-10 opacity-50" />
              <p className="text-sm">No packages match the current filters</p>
              {effectiveShow === 'recommended' && (
                <Button asChild variant="outline" size="sm">
                  <Link href={packagesShowUrl('all', raw)}>Show all packages</Link>
                </Button>
              )}
            </div>
          ) : (
            <PackageList
              results={searchResult.map(({ item, matches }) => ({
                manifest: item.manifest,
                registryName: item.registryName,
                searchWords: getSearchWords(matches),
                recommended: recommended.has(item.registryName.toLowerCase()),
              }))}
            />
          )}
        </div>
      </div>
    </div>
  )
}
