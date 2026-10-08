import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'

let state: { data?: unknown; isPending: boolean; error: Error | null } = { isPending: true, error: null }
const refetch = vi.fn()
vi.mock('../hooks/use-publisher', () => ({
  usePublisherAppArtifacts: () => ({ ...state, refetch, isRefetching: false }),
}))

import { ArtifactsTab } from '../components/artifacts/artifacts-tab'

const versions = Array.from({ length: 7 }, (_, i) => ({ version: `1.${i}.0`, reference: `sha256:${i}` }))

describe('ArtifactsTab', () => {
  beforeEach(() => {
    cleanup()
  })

  it('shows a skeleton while loading', () => {
    state = { isPending: true, error: null }
    render(<ArtifactsTab appId="app-1" />)
    expect(screen.getByRole('status', { name: /loading artifacts/i })).toBeTruthy()
  })

  it('explains what to do when nothing is published', () => {
    state = { isPending: false, error: null, data: [] }
    render(<ArtifactsTab appId="app-1" />)
    expect(screen.getByText('Nothing published yet')).toBeTruthy()
    expect(screen.getByRole('link', { name: /deploy guide/i }).getAttribute('href')).toBe('/docs/deploy')
  })

  it('lists newest versions first, five at a time, with channel pointers', () => {
    state = {
      isPending: false,
      error: null,
      data: [{ kind: 'PACKAGE', name: '@acme/vault', versions, channels: [{ channel: 'LATEST', version: '1.6.0' }] }],
    }
    render(<ArtifactsTab appId="app-1" />)
    const card = screen.getByTestId('artifact-@acme/vault')
    expect(within(card).getByText('Package')).toBeTruthy()
    expect(within(card).getByText('Latest release')).toBeTruthy()
    const rows = within(card).getAllByTestId('artifact-version')
    expect(rows.map((r) => r.textContent?.match(/1\.\d\.0/)?.[0])).toEqual(['1.6.0', '1.5.0', '1.4.0', '1.3.0', '1.2.0'])
    fireEvent.click(within(card).getByRole('button', { name: /show all 7 versions/i }))
    expect(within(card).getAllByTestId('artifact-version')).toHaveLength(7)
  })

  it('offers a retry on error', () => {
    state = { isPending: false, error: new Error('down'), data: undefined }
    render(<ArtifactsTab appId="app-1" />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetch).toHaveBeenCalled()
  })
})
