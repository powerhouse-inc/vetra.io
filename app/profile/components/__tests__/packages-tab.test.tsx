import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/modules/apps/hooks/use-app-profile', () => ({
  useAppName: (_did: unknown, fallback: string) => fallback,
}))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({ useActiveOrg: () => ({ orgId: null }) }))
vi.mock('@/modules/publisher/hooks/use-publisher', () => ({
  usePublisherApps: () => ({
    data: [
      { id: 'dao', name: 'DAO Treasury', status: 'ACTIVE' },
      { id: 'gone', name: 'achra', status: 'DELETED' },
    ],
    isError: false,
  }),
  usePublisherAppArtifacts: (id: string) => ({
    data:
      id === 'dao'
        ? [
            {
              kind: 'PACKAGE',
              name: '@vetra-apps/dao-treasury',
              versions: [{ version: '1.0.2', reference: '' }],
              channels: [],
            },
            { kind: 'FUSION_IMAGE', name: 'frontend', versions: [], channels: [] },
          ]
        : [{ kind: 'PACKAGE', name: '@x/should-not-show', versions: [], channels: [] }],
  }),
}))

import { PackagesTab } from '../packages-tab'

describe('PackagesTab', () => {
  it("lists packages published by the viewer's live apps, linked to the app", () => {
    render(<PackagesTab />)
    const link = screen.getByText('@vetra-apps/dao-treasury').closest('a')
    expect(link?.getAttribute('href')).toBe('/user/apps/dao?tab=artifacts')
    expect(screen.getByText('1.0.2')).toBeTruthy()
    expect(screen.queryByText('frontend')).toBeNull()
    expect(screen.queryByText('@x/should-not-show')).toBeNull()
    expect(screen.queryByRole('link', { name: /browse all packages/i })).toBeNull()
    expect(screen.queryByText(/appear here once/i)).toBeNull()
  })
})
