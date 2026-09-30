import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server'
import { packageModuleTypes } from '../lib/constants'

export const filterParsers = {
  moduleTypes: parseAsArrayOf(parseAsStringLiteral(packageModuleTypes)),
  categories: parseAsArrayOf(parseAsString),
  publisherNames: parseAsArrayOf(parseAsString),
  search: parseAsString,
  show: parseAsStringLiteral(['recommended', 'all']),
  page: parseAsInteger,
}

export const loadSearchParams = createLoader(filterParsers)

type RawParams = Record<string, string | string[] | undefined>

/**
 * Builds a /packages URL from the current params with `overrides` applied (array values
 * serialized as repeated keys, as nuqs parses them). A null override drops the key.
 */
function packagesUrl(raw: RawParams, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (key in overrides || value == null) continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v)
    } else {
      params.set(key, value)
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== null) params.set(key, value)
  }
  const query = params.toString()
  return query ? `/packages?${query}` : '/packages'
}

/** Switches the recommended/all view, keeping search/filters and resetting the page. */
export function packagesShowUrl(show: 'recommended' | 'all', raw: RawParams = {}): string {
  return packagesUrl(raw, { page: null, show })
}

/** Links to a results page, keeping every other param; page 1 drops the param. */
export function packagesPageUrl(page: number, raw: RawParams = {}): string {
  return packagesUrl(raw, { page: page > 1 ? String(page) : null })
}
