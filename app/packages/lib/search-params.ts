import { createLoader, parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs/server'
import { packageModuleTypes } from '../lib/constants'

export const filterParsers = {
  moduleTypes: parseAsArrayOf(parseAsStringLiteral(packageModuleTypes)),
  categories: parseAsArrayOf(parseAsString),
  publisherNames: parseAsArrayOf(parseAsString),
  search: parseAsString,
  show: parseAsStringLiteral(['recommended', 'all']),
}

export const loadSearchParams = createLoader(filterParsers)

/**
 * Builds a /packages URL with the recommended/all view switched, preserving
 * any active search/filter params (array values serialized as repeated keys,
 * as nuqs parses them).
 */
export function packagesShowUrl(
  show: 'recommended' | 'all',
  raw: Record<string, string | string[] | undefined> = {},
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'show' || value == null) continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v)
    } else {
      params.set(key, value)
    }
  }
  params.set('show', show)
  return `/packages?${params.toString()}`
}
