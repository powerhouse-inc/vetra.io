import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { AppStats } from '../lib/app-stats/api'

const DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
const STATS: AppStats = {
  appDid: DID,
  activeUsers30d: 5,
  totalUsers: 12,
  updatedAt: '2026-10-09T08:00:00.000Z',
  metrics: [
    {
      key: 'notes',
      label: 'Notes written',
      unit: 'notes',
      aggregation: 'SUM',
      value: 1234,
      users: 9,
    },
    { key: 'streak', label: 'Best streak', unit: null, aggregation: 'MAX', value: 42, users: 3 },
  ],
}
let state: { data: AppStats | null | undefined; isPending: boolean; error: Error | null }

vi.mock('../hooks/use-app-stats', () => ({ useAppStats: () => state }))

import { AppStatsCard } from '../components/stats/app-stats-card'

beforeEach(() => {
  cleanup()
  state = { data: STATS, isPending: false, error: null }
})

describe('AppStatsCard', () => {
  it('renders nothing without a Renown identity', () => {
    const { container } = render(<AppStatsCard appDid={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows active users and a tile per public metric', () => {
    render(<AppStatsCard appDid={DID} />)
    expect(screen.getByRole('heading', { name: 'Stats' })).toBeTruthy()
    expect(screen.getByText('of 12 users')).toBeTruthy()
    const notes = document.querySelector('[data-metric="notes"]')?.textContent ?? ''
    for (const text of ['1,234', 'notes', 'Notes written', 'Total']) expect(notes).toContain(text)
    expect(document.querySelector('[data-metric="streak"]')?.textContent).toContain('Highest')
    expect(screen.getByRole('link', { name: /View on Renown/ }).getAttribute('href')).toBe(
      `https://www.renown.id/app/${DID}`,
    )
  })

  it('shows only a subtle guide link, no tiles, while there are no public metrics', () => {
    const onEdit = vi.fn()
    state = { data: { ...STATS, metrics: [] }, isPending: false, error: null }
    render(<AppStatsCard appDid={DID} onEdit={onEdit} />)
    expect(document.querySelector('[data-metric]')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Stats' })).toBeNull()
    expect(screen.getByRole('link', { name: 'How to report stats' }).getAttribute('href')).toBe(
      '/docs/app-stats',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Declare metrics' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('link', { name: /View on Renown/ })).toBeNull()
  })

  it('treats null stats and a Renown failure the same way, without breaking the page', () => {
    for (const next of [
      { data: null, isPending: false, error: null },
      { data: undefined, isPending: false, error: new Error('down') },
    ]) {
      cleanup()
      state = next
      render(<AppStatsCard appDid={DID} />)
      expect(document.querySelector('[data-metric]')).toBeNull()
      expect(screen.getByRole('link', { name: 'How to report stats' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Declare metrics' })).toBeNull()
    }
  })
})
