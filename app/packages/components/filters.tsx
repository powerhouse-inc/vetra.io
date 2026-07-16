'use client'

import { useQueryStates } from 'nuqs'
import { filterParsers } from '../lib/search-params'
import { type PackageFilters, type PackageModuleType } from '../lib/types'
import { capitalCase } from 'change-case'
import { Button } from '@/modules/shared/components/ui/button'
import { Checkbox } from '@/modules/shared/components/ui/checkbox'
import { cn } from '@/modules/shared/lib/utils'
import { getCategoryStyle, publisherLabel } from '../lib/category-colors'
import { Search } from './search'

export function Filters(props: {
  moduleTypeOptions: PackageModuleType[]
  categoryOptions: string[]
  publisherNameOptions: string[]
}) {
  const { categoryOptions, publisherNameOptions } = props
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
    })).catch(console.error)
  }

  function removeFilter<TKey extends keyof PackageFilters>(
    key: TKey,
    value: NonNullable<PackageFilters[TKey]>[number],
  ) {
    setFilters((prev) => ({
      ...prev,
      [key]: [...new Set(prev[key]?.filter((v) => v !== value))],
    })).catch(console.error)
  }

  return (
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
  )
}

export function FiltersContent(props: {
  categoryOptions: string[]
  publisherNameOptions: string[]
  moduleTypes: PackageModuleType[] | null
  categories: string[] | null
  publisherNames: string[] | null
  activeFilterCount: number
  clearFilters: () => void
  addFilter: <TKey extends keyof PackageFilters>(
    key: TKey,
    value: NonNullable<PackageFilters[TKey]>[number],
  ) => void
  removeFilter: <TKey extends keyof PackageFilters>(
    key: TKey,
    value: NonNullable<PackageFilters[TKey]>[number],
  ) => void
}) {
  const {
    categoryOptions,
    publisherNameOptions,
    moduleTypes,
    categories,
    publisherNames,
    activeFilterCount,
    clearFilters,
    addFilter,
    removeFilter,
  } = props

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        {activeFilterCount > 0 && (
          <Button
            onClick={clearFilters}
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            Reset
          </Button>
        )}
      </div>
      <Search />
      <FilterSection title="Modules">
        <FilterGroup
          filterKey="moduleTypes"
          title="User Experiences"
          options={['apps', 'editors']}
          values={moduleTypes ?? []}
          addFilter={addFilter}
          removeFilter={removeFilter}
        />
        <FilterGroup
          filterKey="moduleTypes"
          title="Document Models"
          options={['documentModels']}
          values={moduleTypes ?? []}
          addFilter={addFilter}
          removeFilter={removeFilter}
        />
        <FilterGroup
          filterKey="moduleTypes"
          title="Data Integrations"
          options={['subgraphs', 'processors']}
          values={moduleTypes ?? []}
          addFilter={addFilter}
          removeFilter={removeFilter}
        />
      </FilterSection>
      {categoryOptions.length > 0 && (
        <FilterSection title="Categories">
          <FilterGroup
            filterKey="categories"
            options={categoryOptions}
            values={categories ?? []}
            addFilter={addFilter}
            removeFilter={removeFilter}
          />
        </FilterSection>
      )}
      {publisherNameOptions.length > 0 && (
        <FilterSection title="Publishers">
          <FilterGroup
            filterKey="publisherNames"
            options={publisherNameOptions}
            values={publisherNames ?? []}
            addFilter={addFilter}
            removeFilter={removeFilter}
          />
        </FilterSection>
      )}
    </div>
  )
}

function FilterSection(props: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-bold">{props.title}</h4>
      <div className="bg-accent space-y-1 rounded-lg p-3">{props.children}</div>
    </div>
  )
}

const moduleTypeColors: Record<string, string> = {
  documentModels:
    'text-red-700 bg-red-100 border-red-300 dark:text-red-300 dark:bg-red-500/15 dark:border-red-500/30',
  editors:
    'text-orange-700 bg-orange-100 border-orange-300 dark:text-orange-300 dark:bg-orange-500/15 dark:border-orange-500/30',
  apps: 'text-orange-700 bg-orange-100 border-orange-300 dark:text-orange-300 dark:bg-orange-500/15 dark:border-orange-500/30',
  subgraphs:
    'text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-500/15 dark:border-blue-500/30',
  processors:
    'text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-500/15 dark:border-blue-500/30',
}

function getLabelColor(option: string, filterKey: string) {
  if (filterKey === 'moduleTypes') {
    return moduleTypeColors[option] ?? moduleTypeColors.documentModels
  }
  if (filterKey === 'publisherNames') {
    return publisherLabel
  }
  return getCategoryStyle(option).label
}

function FilterGroup<
  TKey extends keyof PackageFilters,
  TValues extends NonNullable<PackageFilters[TKey]>,
>(props: {
  filterKey: TKey
  options: TValues
  values: TValues
  title?: string
  addFilter: (filterKey: TKey, value: TValues[number]) => void
  removeFilter: (filterKey: TKey, value: TValues[number]) => void
}) {
  const { filterKey, options, values, title, addFilter, removeFilter } = props
  return (
    <div>
      {!!title && <h5 className="py-2 text-xs font-semibold">{title}</h5>}
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option}
            htmlFor={option}
            className="flex cursor-pointer items-center justify-between"
          >
            <span
              className={cn(
                'rounded-sm border px-2 py-0.5 text-xs font-semibold',
                getLabelColor(option, filterKey),
              )}
            >
              {capitalCase(option)}
            </span>
            <Checkbox
              id={option}
              checked={(values as string[]).includes(option)}
              onCheckedChange={(checked) => {
                if (checked) addFilter(filterKey, option)
                else removeFilter(filterKey, option)
              }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

export { type PackageFilters }
