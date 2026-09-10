'use client'

import { type Manifest } from '@powerhousedao/shared'
import { ArrowDown, ArrowUp, ArrowUpDown, LayoutGrid, List, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { capitalCase } from 'change-case'
import Link from 'next/link'
import { Button } from '@/modules/shared/components/ui/button'
import { cn } from '@/modules/shared/lib/utils'
import { getCategoryStyle } from '../lib/category-colors'
import { PackageCard } from './package-card'

interface PackageListProps {
  results: { manifest: Manifest; registryName: string; searchWords: string[]; recommended?: boolean }[]
}

type SortKey = 'name' | 'category' | 'publisher' | 'modules'
type SortDir = 'asc' | 'desc'

function getModuleCount(m: Manifest) {
  return (
    (m.documentModels?.length ?? 0) +
    (m.editors?.length ?? 0) +
    (m.apps?.length ?? 0) +
    (m.processors?.length ?? 0) +
    (m.subgraphs?.length ?? 0)
  )
}

function getModuleBreakdown(m: Manifest) {
  const parts: string[] = []
  if (m.documentModels?.length)
    parts.push(`${m.documentModels.length} model${m.documentModels.length > 1 ? 's' : ''}`)
  if (m.editors?.length) parts.push(`${m.editors.length} editor${m.editors.length > 1 ? 's' : ''}`)
  if (m.apps?.length) parts.push(`${m.apps.length} app${m.apps.length > 1 ? 's' : ''}`)
  if (m.processors?.length)
    parts.push(`${m.processors.length} processor${m.processors.length > 1 ? 's' : ''}`)
  if (m.subgraphs?.length)
    parts.push(`${m.subgraphs.length} subgraph${m.subgraphs.length > 1 ? 's' : ''}`)
  return parts
}

export function PackageList({ results }: PackageListProps) {
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const copy = [...results]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = (a.manifest.name || a.registryName).localeCompare(b.manifest.name || b.registryName)
          break
        case 'category':
          cmp = (a.manifest.category ?? '').localeCompare(b.manifest.category ?? '')
          break
        case 'publisher':
          cmp = (a.manifest.publisher?.name ?? '').localeCompare(b.manifest.publisher?.name ?? '')
          break
        case 'modules':
          cmp = getModuleCount(a.manifest) - getModuleCount(b.manifest)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [results, sortKey, sortDir])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {results.length} package{results.length !== 1 ? 's' : ''}
        </p>
        <div className="border-muted flex rounded-lg border-[0.5px] p-0.5">
          <Button
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setView('grid')}
            aria-label="Grid view"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={view === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setView('table')}
            aria-label="Table view"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map(({ manifest, registryName, searchWords, recommended }) => (
            <PackageCard
              key={registryName}
              manifest={manifest}
              registryName={registryName}
              searchWords={searchWords}
              recommended={recommended}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card border-muted overflow-hidden rounded-xl border-[0.5px]">
          <table className="w-full">
            <thead>
              <tr className="bg-accent/50 border-muted border-b-[0.5px] text-xs">
                <SortHeader
                  label="Package"
                  sortKey="name"
                  currentKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Description"
                  sortKey="name"
                  currentKey=""
                  dir={sortDir}
                  onSort={() => {}}
                  className="hidden lg:table-cell"
                  sortable={false}
                />
                <SortHeader
                  label="Category"
                  sortKey="category"
                  currentKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="hidden sm:table-cell"
                />
                <SortHeader
                  label="Publisher"
                  sortKey="publisher"
                  currentKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="hidden md:table-cell"
                />
                <SortHeader
                  label="Modules"
                  sortKey="modules"
                  currentKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                />
              </tr>
            </thead>
            <tbody className="text-sm">
              {sorted.map(({ manifest, registryName, recommended }, i) => {
                const catStyle = getCategoryStyle(manifest.category)
                const count = getModuleCount(manifest)
                return (
                  <tr
                    key={registryName}
                    className={cn(
                      'hover:bg-accent/30 border-muted border-b-[0.5px] transition-colors last:border-0',
                      i % 2 === 0 ? 'bg-card' : 'bg-accent/10',
                    )}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/packages/${encodeURIComponent(registryName)}`}
                        className="hover:text-primary flex items-center gap-1.5 font-medium hover:underline"
                      >
                        {recommended && <Star className="text-primary size-3 shrink-0" />}
                        {manifest.name || registryName}
                      </Link>
                    </td>
                    <td className="hidden max-w-sm px-4 py-3 lg:table-cell">
                      <p className="text-foreground-70 line-clamp-1 text-xs">
                        {manifest.description}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {manifest.category && (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
                            catStyle.bg,
                            catStyle.text,
                          )}
                        >
                          {capitalCase(manifest.category)}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground hidden px-4 py-3 text-xs md:table-cell">
                      {manifest.publisher?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-sm font-medium">{count}</span>
                        {getModuleBreakdown(manifest).map((part) => (
                          <span key={part} className="text-muted-foreground block text-[10px]">
                            {part}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SortHeader(props: {
  label: string
  sortKey: SortKey
  currentKey: string
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
  sortable?: boolean
}) {
  const { label, sortKey, currentKey, dir, onSort, className, sortable = true } = props
  const isActive = sortKey === currentKey

  if (!sortable) {
    return (
      <th className={cn('text-muted-foreground px-4 py-3 text-left font-medium', className)}>
        {label}
      </th>
    )
  }

  return (
    <th className={cn('text-muted-foreground px-4 py-3 text-left font-medium', className)}>
      <button
        className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive ? (
          dir === 'asc' ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  )
}
