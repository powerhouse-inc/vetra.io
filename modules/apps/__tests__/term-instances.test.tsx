import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppsApiError } from '../graphql'
import type { AppInstance, AppPlan, AppRelease } from '../types'

type Q<T> = { data: T | undefined; isPending: boolean; error: Error | null }
let plans: Q<AppPlan[]>
let instances: Q<AppInstance[]>
let releases: AppRelease[]
const create = vi.fn()
const setTarget = vi.fn()
const update = vi.fn()
const retire = vi.fn()
let createError: Error | null = null
const releasesCalls: Array<{ kind: string | null; enabled?: boolean }> = []

const mutation = (mutate: ReturnType<typeof vi.fn>, error: () => Error | null = () => null) => ({
  mutate,
  reset: vi.fn(),
  isPending: false,
  get error() {
    return error()
  },
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-apps', () => ({
  useAppPlans: () => plans,
  useAppInstances: () => instances,
  useAppReleases: (_appId: string, kind: string | null, _limit: number, enabled?: boolean) => {
    releasesCalls.push({ kind, enabled })
    return { data: releases, isPending: false, error: null }
  },
  useCreateAppPlan: () => mutation(create, () => createError),
  useSetAppPlanTarget: () => mutation(setTarget),
  useUpdateAppPlan: () => mutation(update),
  useRetireAppPlan: () => mutation(retire),
}))

import { TermInstances } from '../components/term-instances'

const TERM = { kind: 'pro', name: 'Pro', activeLicenses: 0 }

function plan(over: Partial<AppPlan> = {}): AppPlan {
  return {
    id: 'p1',
    appId: 'a1',
    slug: 'pro',
    name: 'Pro',
    kind: 'pro',
    access: 'shared',
    size: 'VETRA_AGENT_M',
    targetVersion: '1.2.0',
    policy: 'manual',
    noticeHours: 72,
    status: 'active',
    createdAt: '2026-11-12T00:00:00Z',
    updatedAt: '2026-11-12T00:00:00Z',
    ...over,
  }
}

function release(version: string, kind: 'release' | 'build'): AppRelease {
  return { version, kind } as AppRelease
}

function instance(id: string, planId: string | null): AppInstance {
  return { id, planId, kind: 'shared', status: 'ready' } as AppInstance
}

describe('TermInstances', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    releasesCalls.length = 0
    createError = null
    plans = { data: [], isPending: false, error: null }
    instances = { data: [], isPending: false, error: null }
    releases = [release('1.3.0', 'release'), release('1.3.0-build.7', 'build')]
  })

  it('renders nothing on a Vetra without plans', () => {
    plans = { data: undefined, isPending: false, error: new AppsApiError('APPS_UNAVAILABLE', 'x') }
    const { container } = render(<TermInstances appId="a1" term={TERM} />)
    expect(container.textContent).toBe('')
  })

  it('creates a plan from the term with access, size and a release target', () => {
    render(<TermInstances appId="a1" term={TERM} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run instances' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('One instance everyone with this plan uses.')).toBeTruthy()
    expect(within(dialog).getByText('Every holder gets their own instance.')).toBeTruthy()
    // Releases only: the build is not offered.
    const target = within(dialog).getByLabelText('Target release') as HTMLSelectElement
    expect([...target.options].map((o) => o.value)).toEqual(['', '1.3.0'])
    expect(releasesCalls.every((c) => c.kind === 'release')).toBe(true)
    fireEvent.click(within(dialog).getByRole('radio', { name: /Own/ }))
    fireEvent.change(within(dialog).getByLabelText('Size'), {
      target: { value: 'VETRA_AGENT_XL' },
    })
    fireEvent.change(target, { target: { value: '1.3.0' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run instances' }))
    expect(create).toHaveBeenCalledWith(
      {
        kind: 'pro',
        name: 'Pro',
        access: 'own',
        size: 'VETRA_AGENT_XL',
        targetVersion: '1.3.0',
      },
      expect.anything(),
    )
  })

  it("shows the backend's refusal inline", () => {
    createError = new AppsApiError('BAD_USER_INPUT', 'Plans are not enabled on this Vetra')
    render(<TermInstances appId="a1" term={TERM} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run instances' }))
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe(
      'Plans are not enabled on this Vetra',
    )
  })

  it('does not offer instances for a term that already has holders', () => {
    render(<TermInstances appId="a1" term={{ ...TERM, activeLicenses: 3 }} />)
    expect(
      (screen.getByRole('button', { name: 'Run instances' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('summarises an adopted plan with its instance count', () => {
    plans.data = [plan()]
    instances.data = [instance('i1', 'p1'), instance('i2', 'p1'), instance('i3', null)]
    render(<TermInstances appId="a1" term={TERM} />)
    const area = screen.getByTestId('term-instances-pro')
    expect(within(area).getByText('Shared')).toBeTruthy()
    expect(within(area).getByText('M')).toBeTruthy()
    expect(within(area).getByText('1.2.0')).toBeTruthy()
    expect(within(area).getByText('active')).toBeTruthy()
    expect(within(area).getByText('2 instances')).toBeTruthy()
    expect(within(area).queryByRole('button', { name: 'Run instances' })).toBeNull()
  })

  it('moves the plan to another release', () => {
    plans.data = [plan()]
    render(<TermInstances appId="a1" term={TERM} />)
    fireEvent.click(screen.getByRole('button', { name: 'Change target' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Target release'), {
      target: { value: '1.3.0' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move instances' }))
    expect(setTarget).toHaveBeenCalledWith({ planId: 'p1', version: '1.3.0' }, expect.anything())
  })

  it('changes the size', () => {
    plans.data = [plan()]
    render(<TermInstances appId="a1" term={TERM} />)
    fireEvent.click(screen.getByRole('button', { name: 'Change size' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Size'), { target: { value: 'VETRA_AGENT_L' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save size' }))
    expect(update).toHaveBeenCalledWith({ planId: 'p1', size: 'VETRA_AGENT_L' }, expect.anything())
  })

  it('retires after confirmation', () => {
    plans.data = [plan()]
    render(<TermInstances appId="a1" term={TERM} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retire' }))
    expect(retire).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Retire instances' }))
    expect(retire).toHaveBeenCalledWith('p1', expect.anything())
  })

  it('offers no actions on a retired plan', () => {
    plans.data = [plan({ status: 'retired' })]
    render(<TermInstances appId="a1" term={TERM} />)
    expect(screen.getByText('retired')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Change target' })).toBeNull()
  })
})
