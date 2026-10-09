// The Profile tab's form model: what the publisher edits, what is checked
// before saving, and the patch that is sent (only what changed).
import type { RenownAppProfile } from './api'
import {
  metricChanges,
  metricDraftsFrom,
  metricsChanged,
  metricsProblem,
  type AppMetricChange,
  type AppMetricDraft,
} from './metrics'

export const PROFILE_LIMITS = {
  name: 120,
  tagline: 280,
  website: 2048,
  description: 2000,
  category: 40,
  links: 8,
  linkLabel: 40,
  linkUrl: 2048,
} as const

export const CATEGORY_SUGGESTIONS = [
  'AI',
  'Community',
  'Data',
  'Design',
  'Developer tools',
  'Finance',
  'Operations',
  'Productivity',
] as const

export type AppProfileLinkDraft = { id: string; label: string; url: string }

export type AppProfileForm = {
  name: string
  tagline: string
  website: string
  description: string
  category: string
  logoRef: string | null
  coverRef: string | null
  links: AppProfileLinkDraft[]
  metrics: AppMetricDraft[]
}

export type AppProfileField =
  | 'name'
  | 'tagline'
  | 'website'
  | 'description'
  | 'category'
  | 'logo'
  | 'cover'
  | 'links'
  | 'metrics'

/** What updateAppProfile receives: absent = unchanged, "" = clear, links = the whole list. */
export type AppProfileChanges = {
  name?: string
  tagline?: string
  website?: string
  description?: string
  category?: string
  logoRef?: string
  coverRef?: string
  links?: AppProfileLinkDraft[]
  metrics?: AppMetricChange[]
}

const TEXT_FIELDS = ['name', 'tagline', 'website', 'description', 'category'] as const

export function formFromProfile(profile: RenownAppProfile | null): AppProfileForm {
  return {
    name: profile?.name ?? '',
    tagline: profile?.tagline ?? '',
    website: profile?.website ?? '',
    description: profile?.description ?? '',
    category: profile?.category ?? '',
    logoRef: profile?.logoRef ?? null,
    coverRef: profile?.coverRef ?? null,
    links: (profile?.links ?? []).map(({ id, label, url }) => ({ id, label, url })),
    metrics: metricDraftsFrom(profile?.metrics),
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** Whether one link row satisfies the server's rules (label 1–40, http(s) URL ≤ 2048). */
export function isLinkValid(link: AppProfileLinkDraft): boolean {
  const label = link.label.trim()
  const url = link.url.trim()
  return (
    label.length > 0 &&
    label.length <= PROFILE_LIMITS.linkLabel &&
    isHttpUrl(url) &&
    url.length <= PROFILE_LIMITS.linkUrl
  )
}

/** Every problem the server would refuse, per field (empty when the form can be saved). */
export function formProblems(form: AppProfileForm): Partial<Record<AppProfileField, string>> {
  const out: Partial<Record<AppProfileField, string>> = {}
  const max = PROFILE_LIMITS
  if (form.name.trim().length > max.name) out.name = `At most ${max.name} characters.`
  if (form.tagline.trim().length > max.tagline) out.tagline = `At most ${max.tagline} characters.`
  const website = form.website.trim()
  if (website && (!isHttpUrl(website) || website.length > max.website))
    out.website = 'Use an http(s) URL.'
  if (form.description.trim().length > max.description)
    out.description = `At most ${max.description} characters.`
  if (form.category.trim().length > max.category)
    out.category = `At most ${max.category} characters.`
  if (form.links.length > max.links) {
    out.links = `At most ${max.links} links.`
  } else if (form.links.some((l) => !l.label.trim() || l.label.trim().length > max.linkLabel)) {
    out.links = `Every link needs a label of 1–${max.linkLabel} characters.`
  } else if (
    form.links.some((l) => !isHttpUrl(l.url.trim()) || l.url.trim().length > max.linkUrl)
  ) {
    out.links = 'Every link needs an http(s) URL.'
  }
  const metrics = metricsProblem(form.metrics)
  if (metrics) out.metrics = metrics
  return out
}

function trimmedLinks(links: AppProfileLinkDraft[]): AppProfileLinkDraft[] {
  return links.map(({ id, label, url }) => ({ id, label: label.trim(), url: url.trim() }))
}

/** The patch from `initial` to `current`: changed text trimmed ("" clears), image refs ("" clears), whole link list. */
export function changedFields(initial: AppProfileForm, current: AppProfileForm): AppProfileChanges {
  const out: AppProfileChanges = {}
  for (const key of TEXT_FIELDS) {
    const next = current[key].trim()
    if (next !== initial[key].trim()) out[key] = next
  }
  if (current.logoRef !== initial.logoRef) out.logoRef = current.logoRef ?? ''
  if (current.coverRef !== initial.coverRef) out.coverRef = current.coverRef ?? ''
  const links = trimmedLinks(current.links)
  if (JSON.stringify(links) !== JSON.stringify(trimmedLinks(initial.links))) out.links = links
  if (metricsChanged(initial.metrics, current.metrics)) out.metrics = metricChanges(current.metrics)
  return out
}

export function hasChanges(changes: AppProfileChanges): boolean {
  return Object.keys(changes).length > 0
}

/** The form field a server error's `extensions.field` belongs to, or null. */
export function fieldForServer(field: string | null | undefined): AppProfileField | null {
  switch (field) {
    case 'logoRef':
    case 'logo':
      return 'logo'
    case 'coverRef':
      return 'cover'
    case 'name':
    case 'tagline':
    case 'website':
    case 'description':
    case 'category':
    case 'links':
    case 'metrics':
      return field
    default:
      return null
  }
}

/** A new link's id (any unique string; Renown stores it as the link's OID). */
export function newLinkId(): string {
  return crypto.randomUUID()
}
