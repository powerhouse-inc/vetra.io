import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/modules/shared/components/ui/pagination'
import { packagesPageUrl } from '../lib/search-params'

/** First, last and the current page with its neighbours; null marks a gap. */
export function pageNumbers(page: number, pageCount: number): (number | null)[] {
  const pages: (number | null)[] = []
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p)
    else if (pages.at(-1) !== null) pages.push(null)
  }
  return pages
}

export function PackagePagination(props: {
  page: number
  pageCount: number
  raw: Record<string, string | string[] | undefined>
}) {
  const { page, pageCount, raw } = props
  if (pageCount <= 1) return null

  return (
    <Pagination>
      <PaginationContent>
        {page > 1 && (
          <PaginationItem>
            <PaginationPrevious href={packagesPageUrl(page - 1, raw)} />
          </PaginationItem>
        )}
        {pageNumbers(page, pageCount).map((p, i) => (
          <PaginationItem key={p ?? `gap-${i}`}>
            {p === null ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink href={packagesPageUrl(p, raw)} isActive={p === page}>
                {p}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        {page < pageCount && (
          <PaginationItem>
            <PaginationNext href={packagesPageUrl(page + 1, raw)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
