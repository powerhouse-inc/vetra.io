'use client'

import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useQueryStates } from 'nuqs'
import { Button } from '@/modules/shared/components/ui/button'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/modules/shared/components/ui/sheet'
import { FiltersContent } from './filters'
import { filterParsers } from '../lib/search-params'
import { type PackageFilters, type PackageModuleType } from '../lib/types'

export function MobileFilters(props: {
  moduleTypeOptions: PackageModuleType[]
  categoryOptions: string[]
  publisherNameOptions: string[]
}) {
  const { categoryOptions, publisherNameOptions } = props
  const [open, setOpen] = useState(false)
  const [{ moduleTypes, categories, publisherNames }, setFilters] = useQueryStates(filterParsers, {
    shallow: false,
  })

  const activeFilterCount =
    (moduleTypes?.length ?? 0) + (categories?.length ?? 0) + (publisherNames?.length ?? 0)

  function clearFilters() {
    setFilters(null).catch(console.error)
  }

  function addFilter<TKey extends keyof PackageFilters>(
    key: TKey,
    value: NonNullable<PackageFilters[TKey]>[number],
  ) {
    setFilters((prev) => ({
      ...prev,
      [key]: [...new Set([...(prev[key] ?? []), value])],
      page: null,
    })).catch(console.error)
  }

  function removeFilter<TKey extends keyof PackageFilters>(
    key: TKey,
    value: NonNullable<PackageFilters[TKey]>[number],
  ) {
    setFilters((prev) => ({
      ...prev,
      [key]: [...new Set(prev[key]?.filter((v) => v !== value))],
      page: null,
    })).catch(console.error)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <SlidersHorizontal className="size-4" />
        Filters
        {activeFilterCount > 0 && (
          <Badge variant="default" size="xs" className="size-5 justify-center rounded-full p-0">
            {activeFilterCount}
          </Badge>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <FiltersContent
              categoryOptions={categoryOptions}
              publisherNameOptions={publisherNameOptions}
              moduleTypes={moduleTypes}
              categories={categories}
              publisherNames={publisherNames}
              activeFilterCount={activeFilterCount}
              clearFilters={clearFilters}
              addFilter={addFilter}
              removeFilter={removeFilter}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
