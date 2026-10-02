import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GITHUB_REAUTH_KEY } from '@/modules/apps/lib/github-state'

const startGithubFlow = vi.fn()
vi.mock('@/modules/apps/lib/github-state', async (orig) => ({
  ...(await orig<typeof import('@/modules/apps/lib/github-state')>()),
  startGithubFlow: (url: string) => {
    startGithubFlow(url)
  },
}))

import { GithubFlowLink } from '@/modules/apps/components/github-flow-link'

beforeEach(() => {
  sessionStorage.clear()
  startGithubFlow.mockReset()
})

describe('GithubFlowLink', () => {
  it('a user-started flow resets the automatic re-authorize allowance', () => {
    sessionStorage.setItem(GITHUB_REAUTH_KEY, '1')
    const { getByText } = render(
      <GithubFlowLink url="https://github.com/apps/vetra-deploy/installations/new">
        Install
      </GithubFlowLink>,
    )
    fireEvent.click(getByText('Install'))
    expect(startGithubFlow).toHaveBeenCalledWith(
      'https://github.com/apps/vetra-deploy/installations/new',
    )
    expect(sessionStorage.getItem(GITHUB_REAUTH_KEY)).toBeNull()
  })
})
