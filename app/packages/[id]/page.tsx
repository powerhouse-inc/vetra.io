import { capitalCase } from 'change-case'
import {
  Calendar,
  Download,
  ExternalLink,
  FileCode2,
  Github,
  PackageIcon,
  Scale,
  Tag,
  Users,
} from 'lucide-react'
import { notFound } from 'next/navigation'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/modules/shared/components/ui/breadcrumb'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'
import { REGISTRY_URL } from '../lib/constants'
import { getCategoryStyle } from '../lib/category-colors'
import { getPackageManifest, getPackageRegistryData } from '../lib/registry'
import { CopyCommand } from '../components/copy-command'
import { VersionList } from '../components/version-list'
import { EVENTS, TrackView } from '@/shared/analytics'
import { SourceViewer } from '../components/source-viewer'
import { ModuleExplorer } from '../components/module-explorer'
import { AddToCloud } from '../components/add-to-cloud'

interface PackageDetailPageProps {
  params: { id: string }
  searchParams: Promise<{ v?: string }>
}

export async function generateMetadata({ params }: PackageDetailPageProps): Promise<unknown> {
  try {
    const decodedName = decodeURIComponent((await params).id)
    const pkg = await getPackageManifest(decodedName)
    if (!pkg?.manifest) {
      return {
        title: 'Package Not Found',
        description: 'The requested package could not be found.',
      }
    }
    const title = `${pkg.manifest.name} | Vetra Package`
    const description = pkg.manifest.description || `Explore ${pkg.manifest.name} package on Vetra.`
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://vetra.to/packages/${encodeURIComponent(pkg.manifest.name)}`,
        siteName: 'Vetra',
        type: 'website',
        images: [
          {
            url: 'https://vetra.to/vetra-logo.png',
            width: 1200,
            height: 630,
            alt: pkg.manifest.name,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ['https://vetra.to/vetra-logo.png'],
        site: '@vetra',
      },
    }
  } catch {
    return { title: 'Vetra Package', description: 'Explore packages on Vetra.' }
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

async function fetchCdnFile(
  cdnBase: string,
  filePath: string,
): Promise<{ content: string; type: 'json' | 'js' | 'css' | 'text' } | null> {
  try {
    const res = await fetch(`${cdnBase}/${filePath}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const text = await res.text()
    const ext = filePath.split('.').pop() ?? ''
    if (ext === 'json') {
      try {
        return { content: JSON.stringify(JSON.parse(text), null, 2), type: 'json' }
      } catch {
        return { content: text, type: 'json' }
      }
    }
    if (ext === 'css') return { content: text, type: 'css' }
    if (ext === 'js' || ext === 'mjs' || ext === 'ts' || ext === 'dts')
      return { content: text, type: 'js' }
    return { content: text, type: 'text' }
  } catch {
    return null
  }
}

export default async function PackageDetailPage({ params, searchParams }: PackageDetailPageProps) {
  const decodedName = decodeURIComponent((await params).id)
  const { v: selectedVersion } = await searchParams

  const [pkg, registryData] = await Promise.all([
    getPackageManifest(decodedName),
    getPackageRegistryData(decodedName),
  ])

  if (!pkg?.manifest) {
    notFound()
  }

  const { manifest } = pkg
  const catStyle = getCategoryStyle(manifest.category)

  const modules = {
    documentModels: manifest.documentModels,
    editors: manifest.editors,
    apps: manifest.apps,
    processors: manifest.processors,
    subgraphs: manifest.subgraphs,
  }
  const moduleCount = Object.values(modules).reduce((s, m) => s + (m?.length ?? 0), 0)

  // Registry metadata
  const distTags = registryData?.['dist-tags'] ?? {}
  const latestVersion = distTags.latest ?? Object.keys(registryData?.versions ?? {}).pop() ?? '—'
  const activeVersion =
    selectedVersion && registryData?.versions?.[selectedVersion] ? selectedVersion : latestVersion
  const isLatest = activeVersion === latestVersion
  const showVersion = !!selectedVersion || !isLatest
  const versions = Object.keys(registryData?.versions ?? {}).reverse()
  const timestamps = registryData?.time ?? {}
  const versionMeta = registryData?.versions?.[activeVersion]
  const license = versionMeta?.license
  const repository = versionMeta?.repository
  const dependencies = versionMeta?.dependencies ?? {}
  const maintainers = versionMeta?.maintainers ?? []
  const dist = versionMeta?.dist
  // Find which dist-tag points to this version
  const activeTag = Object.entries(distTags).find(([, v]) => v === activeVersion)?.[0]

  const repoUrl = repository?.url
    ?.replace(/^git\+/, '')
    ?.replace(/\.git$/, '')
    ?.replace(/^ssh:\/\/git@github\.com/, 'https://github.com')

  const createdAt = timestamps.created
  const modifiedAt = timestamps.modified
  const versionDate = timestamps[activeVersion]

  // Fetch source files from CDN for the active version
  const cdnBase = `${REGISTRY_URL}/-/cdn/${manifest.name}@${activeVersion}`

  const filesToFetch = [
    { name: 'manifest.json', path: 'powerhouse.manifest.json' },
    { name: 'package.json', path: 'package.json' },
  ]

  const sourceFileResults = await Promise.all(
    filesToFetch.map(async ({ name, path }) => {
      const result = await fetchCdnFile(cdnBase, path)
      if (!result) return null
      return { name, path, content: result.content, type: result.type }
    }),
  )
  const sourceFiles = sourceFileResults.filter(Boolean) as {
    name: string
    path: string
    content: string
    type: string
  }[]

  return (
    <main className="container mx-auto mt-20 max-w-screen-xl space-y-8 overflow-hidden px-6 py-8">
      <TrackView
        event={EVENTS.packageView}
        properties={{ name: manifest.name, version: activeVersion }}
      />
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/packages">Packages</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[200px] truncate sm:max-w-none">
              {manifest.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero Header */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
            <PackageIcon className="text-primary size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold break-words sm:text-2xl">{manifest.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant={isLatest ? 'default' : 'secondary'} className="font-mono text-xs">
                {activeVersion}
              </Badge>
              {activeTag && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Tag className="size-3" />
                  {activeTag}
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
              {license && (
                <span className="flex items-center gap-1">
                  <Scale className="size-3" />
                  {license}
                </span>
              )}
              {versionDate && (
                <>
                  {license && <span>·</span>}
                  <span>Published {formatDate(versionDate)}</span>
                </>
              )}
              {!isLatest && (
                <>
                  <span>·</span>
                  <a
                    href={`/packages/${encodeURIComponent(manifest.name)}`}
                    className="text-primary hover:underline"
                  >
                    View latest ({latestVersion})
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2">
          {manifest.publisher?.name && (
            <Badge variant="secondary">
              by{' '}
              {manifest.publisher.url ? (
                <a
                  href={manifest.publisher.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {manifest.publisher.name}
                </a>
              ) : (
                manifest.publisher.name
              )}
            </Badge>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid w-full grid-cols-1 gap-8 overflow-hidden lg:grid-cols-3">
        {/* Left column */}
        <div className="min-w-0 space-y-6 overflow-hidden lg:col-span-2">
          {/* About */}
          {manifest.description && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold">About</h2>
                  {repoUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 gap-2"
                      >
                        <Github className="size-4" />
                        Repository
                      </a>
                    </Button>
                  )}
                </div>
                <p className="text-foreground-70 mt-3 leading-relaxed">{manifest.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {manifest.category && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${catStyle.bg} ${catStyle.text}`}
                    >
                      {capitalCase(manifest.category)}
                    </span>
                  )}
                  {moduleCount > 0 && (
                    <Badge variant="outline">
                      {moduleCount} module{moduleCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Modules - interactive explorer */}
          <Card className="overflow-hidden">
            <CardContent className="min-w-0 p-4 sm:p-6">
              <ModuleExplorer modules={modules} cdnBase={cdnBase} />
            </CardContent>
          </Card>

          {/* Versions */}
          {versions.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <VersionList
                  versions={versions}
                  distTags={distTags}
                  timestamps={timestamps}
                  packageName={manifest.name}
                  registryUrl={REGISTRY_URL}
                />
              </CardContent>
            </Card>
          )}

          {/* Dependencies */}
          {Object.keys(dependencies).length > 0 && (
            <Card className="overflow-hidden">
              <CardContent className="min-w-0 p-4 sm:p-6">
                <h2 className="mb-3 text-lg font-semibold">
                  Dependencies
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    ({Object.keys(dependencies).length})
                  </span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dependencies).map(([name, version]) => (
                    <span
                      key={name}
                      className="bg-accent/30 border-muted rounded-md border-[0.5px] px-2.5 py-1 text-xs break-all"
                    >
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground ml-1">{version}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Source */}
          {sourceFiles.length > 0 && (
            <Card className="overflow-hidden">
              <CardContent className="min-w-0 p-4 sm:p-6">
                <SourceViewer files={sourceFiles} repoUrl={repoUrl} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="min-w-0 space-y-6 overflow-hidden">
          {/* Install */}
          <Card className="border-primary/20 bg-primary/5 border-[0.5px]">
            <CardContent className="space-y-4 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <PackageIcon className="text-primary size-4" />
                Install
              </h3>
              <CopyCommand
                command={`ph install ${manifest.name}${showVersion ? `@${activeVersion}` : ''}`}
                packageName={manifest.name}
              />
              <p className="text-muted-foreground text-[11px]">
                Requires{' '}
                <a
                  href="https://github.com/powerhouse-inc/powerhouse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Powerhouse CLI
                </a>
              </p>
            </CardContent>
          </Card>

          {/* Add to Cloud */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <svg
                  className="text-primary size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                </svg>
                Add to Cloud
              </h3>
              <AddToCloud
                packageName={manifest.name}
                version={showVersion ? activeVersion : undefined}
              />
            </CardContent>
          </Card>

          {/* Package metadata */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <h3 className="text-sm font-semibold">Package Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono">{activeVersion}</span>
                </div>
                {license && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">License</span>
                    <span>{license}</span>
                  </div>
                )}
                {dist?.unpackedSize && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span>{formatBytes(dist.unpackedSize)}</span>
                  </div>
                )}
                {dist?.fileCount && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Files</span>
                    <span>{dist.fileCount}</span>
                  </div>
                )}
                {createdAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Published</span>
                    <span className="flex items-center gap-1 text-xs">
                      <Calendar className="size-3" />
                      {formatDate(createdAt)}
                    </span>
                  </div>
                )}
                {modifiedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="flex items-center gap-1 text-xs">
                      <Calendar className="size-3" />
                      {formatDate(modifiedAt)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Links */}
          {(repoUrl || dist?.tarball) && (
            <Card>
              <CardContent className="space-y-2 p-5">
                <h3 className="mb-3 text-sm font-semibold">Links</h3>
                {repoUrl && (
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
                  >
                    <Github className="text-muted-foreground size-4" />
                    Repository
                    <ExternalLink className="text-muted-foreground ml-auto size-3" />
                  </a>
                )}
                {dist?.tarball && (
                  <a
                    href={dist.tarball}
                    className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
                  >
                    <Download className="text-muted-foreground size-4" />
                    Download Tarball
                    <ExternalLink className="text-muted-foreground ml-auto size-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Maintainers */}
          {maintainers.length > 0 && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4" />
                  Maintainers
                  <span className="text-muted-foreground font-normal">({maintainers.length})</span>
                </h3>
                <div className="space-y-2">
                  {maintainers.map((m) => (
                    <div key={m.name} className="flex items-center gap-2 text-sm">
                      <div className="bg-accent flex size-7 items-center justify-center rounded-full text-xs font-semibold uppercase">
                        {m.name[0]}
                      </div>
                      <span>{m.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
