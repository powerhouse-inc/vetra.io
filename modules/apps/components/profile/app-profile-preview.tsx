import { ArrowUpRight } from 'lucide-react'
import { Badge } from '@/modules/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import { isHttpUrl, type AppProfileForm } from '../../lib/app-profile/form'
import type { ImageKind } from '../../lib/app-profile/image'
import { renownMediaUrl } from '../../lib/app-profile/renown'
import { hueFor } from '../app-avatar'
import { AppLogo, safeLegacyLogo } from './app-logo'
import { MarkdownLite } from './markdown-lite'

/** Local previews of images uploaded in this session (they win over stored ones). */
export type ImagePreviews = Record<ImageKind, string | null>

/** The profile as Renown will show it, from the form's current values. */
export function AppProfilePreview({
  appName,
  appDid,
  form,
  documentId,
  previews,
  legacyLogo,
  compact = false,
}: {
  appName: string
  appDid: string
  form: AppProfileForm
  documentId: string | null
  previews: ImagePreviews
  legacyLogo: string | null
  compact?: boolean
}) {
  const name = form.name.trim() || appName
  const category = form.category.trim()
  const tagline = form.tagline.trim()
  const description = form.description.trim()
  const coverSrc =
    previews.cover ?? (form.coverRef && documentId ? renownMediaUrl(documentId, 'cover') : null)
  const logoSrc =
    previews.logo ??
    (form.logoRef
      ? documentId
        ? renownMediaUrl(documentId, 'logo')
        : null
      : safeLegacyLogo(legacyLogo))
  const links = form.links.filter((link) => link.label.trim() && isHttpUrl(link.url.trim()))
  const hue = hueFor(appDid)

  return (
    <div className="bg-card border-border overflow-hidden rounded-2xl border shadow-sm">
      <div
        className="aspect-[3/1] w-full"
        style={
          coverSrc
            ? undefined
            : {
                backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 75% 35%))`,
              }
        }
      >
        {coverSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- Renown /media 302s to short-lived storage URLs
          <img src={coverSrc} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="space-y-3 px-5 pb-5">
        <AppLogo name={name} seed={appDid} src={logoSrc} className="ring-card -mt-8 ring-4" />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg leading-tight font-semibold">{name}</h3>
            {category && <Badge variant="secondary">{category}</Badge>}
          </div>
          {tagline && <p className="text-muted-foreground text-sm">{tagline}</p>}
        </div>
        {description && (
          <MarkdownLite text={description} className={cn('text-sm', compact && 'line-clamp-4')} />
        )}
        {links.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Links">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url.trim()}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="bg-muted hover:bg-muted/70 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                >
                  {link.label.trim()}
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
