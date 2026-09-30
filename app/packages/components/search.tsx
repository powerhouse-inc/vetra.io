'use client'

import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { Search as SearchIcon } from 'lucide-react'
import { Input } from '@/modules/shared/components/ui/input'

export function Search() {
  const [{ search: searchText }, setParams] = useQueryStates(
    { search: parseAsString, page: parseAsInteger },
    { shallow: false },
  )

  return (
    <div className="relative">
      <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        className="pl-8"
        placeholder="Search packages..."
        type="text"
        aria-label="Search packages"
        value={searchText ?? ''}
        onChange={(e) => {
          setParams({ search: e.currentTarget.value, page: null }).catch(console.error)
        }}
      />
    </div>
  )
}
