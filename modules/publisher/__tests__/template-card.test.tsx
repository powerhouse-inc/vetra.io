import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import type { PublisherTemplate } from '../types'

const warmPool = vi.fn()
vi.mock('../hooks/use-publisher', () => ({
  useWarmPool: (...a: unknown[]) => (warmPool as (...x: unknown[]) => unknown)(...a),
}))

import { TemplateCard } from '../components/templates/template-card'

const tpl = (over: Partial<PublisherTemplate> = {}): PublisherTemplate => ({
  id: 'tpl-1',
  name: 'Pro',
  mode: 'DEDICATED',
  sharedEnvironment: null,
  size: null,
  baseDomain: null,
  packageRegistry: null,
  services: [],
  packages: [],
  templateHash: 'h',
  environmentCount: 2,
  warmPoolSize: 0,
  ...over,
})

const renderCard = (t = tpl()) =>
  render(
    <TemplateCard appId="app-1" template={t} usedBy={[]} onEdit={vi.fn()} onDelete={vi.fn()} />,
  )

describe('TemplateCard warm pool', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows the pool and its hours beside the environment count', () => {
    warmPool.mockReturnValue({
      data: { size: 3, warming: 1, available: 2, warmHoursThisMonth: 12.46 },
    })
    renderCard()
    expect(screen.getByText('2 environments')).toBeTruthy()
    expect(screen.getByText('3 warm, 2 ready')).toBeTruthy()
    expect(screen.getByText('12.5 warm hours this month')).toBeTruthy()
    expect(warmPool).toHaveBeenCalledWith('app-1', 'tpl-1', true)
  })

  it('renders without the pool lines when the pool failed or has not loaded', () => {
    warmPool.mockReturnValue({ data: undefined, isError: true })
    renderCard()
    expect(screen.getByText('2 environments')).toBeTruthy()
    expect(screen.queryByText(/warm/)).toBeNull()
  })

  it('shows nothing for an empty pool', () => {
    warmPool.mockReturnValue({
      data: { size: 0, warming: 0, available: 0, warmHoursThisMonth: 0 },
    })
    renderCard()
    expect(screen.queryByText(/warm/)).toBeNull()
  })

  it('does not ask for a shared template pool', () => {
    warmPool.mockReturnValue({ data: undefined })
    renderCard(tpl({ mode: 'SHARED' }))
    expect(warmPool).toHaveBeenCalledWith('app-1', 'tpl-1', false)
  })
})
