import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { App } from '../types'

vi.mock('../hooks/use-app-profile', () => ({
  useAppName: (_did: unknown, fallback: string) => fallback,
  useAppLogo: () => null,
}))
vi.mock('../components/setup-deploys', () => ({ SetupDeploys: () => <div>workflow-setup</div> }))

import { GettingStarted } from '../components/app-overview'

const app = {
  id: 'a1',
  name: 'Canary',
  status: 'ACTIVE',
  identityDid: null,
  repository: { fullName: 'acme/canary' },
} as unknown as App

const step = (title: string) => screen.getByText(title).closest('li') as HTMLElement
const isDone = (title: string) => step(title).textContent?.includes('Done') ?? false

describe('GettingStarted', () => {
  beforeEach(() => cleanup())

  it('walks a publisher from repo to invite codes', () => {
    render(
      <GettingStarted
        app={app}
        published={false}
        licensing={{ plans: false, inviteCodes: false }}
        onAuthorize={vi.fn()}
        onOpenTab={vi.fn()}
      />,
    )
    expect(screen.getByText(/plans and invite codes/i)).toBeTruthy()
    expect(screen.queryByText(/live production URL/i)).toBeNull()
    expect(isDone('Connected acme/canary')).toBe(true)
    expect(isDone('Authorize the deploy identity')).toBe(true)
    expect(isDone('Add the workflow and publish a release')).toBe(false)
    expect(screen.getByText('workflow-setup')).toBeTruthy()
    expect(isDone('Create a plan')).toBe(false)
    expect(isDone('Create invite codes')).toBe(false)
  })

  it('counts the first release as published', () => {
    render(
      <GettingStarted
        app={app}
        published
        licensing={{ plans: true, inviteCodes: false }}
        onAuthorize={vi.fn()}
        onOpenTab={vi.fn()}
      />,
    )
    expect(isDone('Add the workflow and publish a release')).toBe(true)
    expect(screen.queryByText('workflow-setup')).toBeNull()
    expect(isDone('Create a plan')).toBe(true)
    expect(isDone('Create invite codes')).toBe(false)
  })

  it('opens the Plans and Invite codes tabs', () => {
    const onOpenTab = vi.fn()
    render(
      <GettingStarted
        app={app}
        published
        licensing={{ plans: false, inviteCodes: false }}
        onAuthorize={vi.fn()}
        onOpenTab={onOpenTab}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /open plans/i }))
    fireEvent.click(screen.getByRole('button', { name: /open invite codes/i }))
    expect(onOpenTab.mock.calls).toEqual([['plans'], ['invite-codes']])
  })

  it('leaves out plans and invite codes for someone who cannot manage licensing', () => {
    render(
      <GettingStarted
        app={app}
        published={false}
        licensing={null}
        onAuthorize={vi.fn()}
        onOpenTab={vi.fn()}
      />,
    )
    expect(screen.queryByText('Create a plan')).toBeNull()
    expect(screen.queryByText('Create invite codes')).toBeNull()
  })
})
