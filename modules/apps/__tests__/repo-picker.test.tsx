import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

let infoState: { data?: unknown; error?: Error | null } = {}
let installationsState: { data?: unknown; isPending?: boolean; error?: Error | null } = {}

vi.mock('../hooks/use-apps', () => ({
  useGithubDeployAppInfo: () => infoState,
  useMyGithubDeployInstallations: () => installationsState,
  useGithubRepositories: () => ({ data: [], isPending: false, error: null }),
}))

import { RepoPicker } from '../components/repo-picker'
import { AppsApiError } from '../graphql'

beforeEach(() => {
  cleanup()
  infoState = { data: undefined, error: null }
  installationsState = { data: [], isPending: false, error: null }
})

describe('RepoPicker when the server has no GitHub App configured', () => {
  // Without installUrl the Install button is an anchor with no href: it looks
  // enabled and silently does nothing. That is what a publisher actually hit on
  // staging, where no GITHUB_DEPLOY_APP_* was set.
  it('explains the failure instead of rendering a button that does nothing', () => {
    infoState = {
      data: undefined,
      error: new AppsApiError(
        'SERVICE_NOT_CONFIGURED',
        'The Vetra Deploy GitHub App is not configured',
        503,
      ),
    }
    render(<RepoPicker installationId={null} onInstallationChange={() => {}} onPick={() => {}} />)

    expect(screen.getByText(/github deployment is unavailable/i)).toBeTruthy()
    expect(screen.getByText(/not fully configured on this server/i)).toBeTruthy()
    // the dead control must be gone, not merely accompanied by a message
    expect(screen.queryByText(/install vetra deploy/i)).toBeNull()
  })

  it('still offers the install button when the app info loaded', () => {
    infoState = {
      data: {
        slug: 'vetra-deploy',
        installUrl: 'https://github.com/apps/vetra-deploy/installations/new',
        authorizeUrl: 'https://github.com/login/oauth/authorize?client_id=x',
      },
      error: null,
    }
    render(<RepoPicker installationId={null} onInstallationChange={() => {}} onPick={() => {}} />)

    const link = screen.getByText(/install vetra deploy/i).closest('a')
    expect(link?.getAttribute('href')).toBe(
      'https://github.com/apps/vetra-deploy/installations/new',
    )
  })
})
