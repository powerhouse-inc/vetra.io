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
import { loadSearchParams, packagesPageUrl, packagesShowUrl } from './lib/search-params'
import { recommendedNames } from './lib/recommended'
import { Filters } from './components/filters'
import { MobileFilters } from './components/mobile-filters'
import { packageModuleTypes } from './lib/constants'
import { listPackages, npmName } from './lib/registry'
import { PackageList } from './components/package-list'
import { PackagePagination } from './components/package-pagination'
import { CreatePackageModal } from './components/create-package-modal'

const PAGE_SIZE = 30

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
  const { search, show, page, moduleTypes, categories, publisherNames } =
    await loadSearchParams(searchParams)
  const recommended = recommendedNames()
  const effectiveShow = recommended.size > 0 ? (show ?? 'recommended') : 'all'
  const currentPage = Math.max(page ?? 1, 1)
  const result = await listPackages(
    {
      search,
      names: effectiveShow === 'recommended' ? [...recommended] : null,
      categories,
      publishers: publisherNames,
      moduleTypes,
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    },
    { detail: 'full', init: { next: { revalidate: 30 } } },
  )
  const results = result.items.flatMap((p) =>
    p.manifest
      ? [
          {
            manifest: p.manifest,
            registryName: npmName(p),
            searchWords: search ? [search] : [],
            recommended: recommended.has(npmName(p).toLowerCase()),
          },
        ]
      : [],
  )
  const categoryOptions = result.facets.categories
  const publisherNameOptions = result.facets.publishers
  const pageCount = Math.ceil(result.total / PAGE_SIZE)

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
          {results.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-20">
              <SearchIcon className="size-10 opacity-50" />
              <p className="text-sm">No packages match the current filters</p>
              {result.total > 0 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={packagesPageUrl(1, raw)}>Back to the first page</Link>
                </Button>
              )}
              {effectiveShow === 'recommended' && (
                <Button asChild variant="outline" size="sm">
                  <Link href={packagesShowUrl('all', raw)}>Show all packages</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <PackageList results={results} total={result.total} />
              <PackagePagination page={currentPage} pageCount={pageCount} raw={raw} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
