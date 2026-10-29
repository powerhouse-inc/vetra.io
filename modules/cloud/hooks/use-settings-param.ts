'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export const SETTINGS_TABS = ['domain', 'updates', 'activity', 'metadata'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

/**
 * `?settings=` value → the settings tab to show, or null when settings are closed.
 * `organisation` is the older link to the hand-over, which lives on Metadata.
 */
export function parseSettingsTab(value: string | null): SettingsTab | null {
  if (value === 'organisation') return 'metadata'
  return SETTINGS_TABS.find((tab) => tab === value) ?? null
}

/**
 * Environment settings drawer state in the URL (`?settings=<tab>`), so every
 * settings section can be linked and survives a reload. Mirrors useDetailDrawer.
 */
export function useSettingsParam() {
  const router = useRouter()
  const params = useSearchParams()
  const tab = parseSettingsTab(params.get('settings'))

  const setTab = useCallback(
    (next: SettingsTab | null) => {
      const query = new URLSearchParams(params.toString())
      if (next) query.set('settings', next)
      else query.delete('settings')
      const qs = query.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    },
    [params, router],
  )

  return { tab, setTab }
}
