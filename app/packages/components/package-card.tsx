import { type Manifest } from '@powerhousedao/shared'
import { capitalCase } from 'change-case'
import { PackageIcon, Star } from 'lucide-react'
import Link from 'next/link'
import Highlighter from 'react-highlight-words'
import { Card, CardContent } from '@/modules/shared/components/ui/card'
import { Badge } from '@/modules/shared/components/ui/badge'
import { cn } from '@/modules/shared/lib/utils'
import { getCategoryStyle } from '../lib/category-colors'

export function PackageCard(props: {
  manifest: Manifest
  registryName: string
  searchWords: string[]
  recommended?: boolean
}) {
  const { manifest, registryName, searchWords, recommended } = props
  const { publisher, description, category, documentModels, editors, apps, processors, subgraphs } =
    manifest

  // Some registry entries ship an empty manifest name; fall back to the
  // registered npm name so the card title and detail link stay usable.
  const name = manifest.name || registryName

  const moduleCount =
    (documentModels?.length ?? 0) +
    (editors?.length ?? 0) +
    (apps?.length ?? 0) +
    (processors?.length ?? 0) +
    (subgraphs?.length ?? 0)

  const catStyle = getCategoryStyle(category)

  return (
    <Link href={`/packages/${encodeURIComponent(registryName)}`}>
      <Card
        className={cn(
          'flex h-full flex-col border-t-3 transition-shadow hover:shadow-md',
          'border-t-gray-300',
        )}
      >
        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start gap-2">
            <PackageIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <h3 className="text-sm font-semibold break-all">
              <PurpleHighlighter textToHighlight={name} searchWords={searchWords} />
            </h3>
          </div>

          {publisher?.name && (
            <p className="text-muted-foreground text-xs">
              by <PurpleHighlighter textToHighlight={publisher.name} searchWords={searchWords} />
            </p>
          )}

          {description && (
            <p className="text-foreground-70 text-xs leading-relaxed">
              <PurpleHighlighter textToHighlight={description} searchWords={searchWords} />
            </p>
          )}

          <div className="mt-auto flex flex-wrap gap-1 pt-2">
            {recommended && (
              <Badge size="xs">
                <Star className="size-3" />
                Powerhouse Recommended
              </Badge>
            )}
            {category && (
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium',
                  catStyle.bg,
                  catStyle.text,
                )}
              >
                <PurpleHighlighter
                  textToHighlight={capitalCase(category)}
                  searchWords={searchWords}
                />
              </span>
            )}
            {moduleCount > 0 && (
              <Badge size="xs" variant="outline">
                {moduleCount} module{moduleCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function PurpleHighlighter(props: { textToHighlight: string; searchWords: string[] }) {
  return <Highlighter {...props} highlightClassName="bg-purple-30" />
}
