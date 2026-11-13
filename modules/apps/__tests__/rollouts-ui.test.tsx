import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AppInstance,
  AppPlan,
  AppRelease,
  AppRollout,
  AppRolloutCheck,
  InstanceBackup,
} from '../types'

type Q<T> = { data: T | undefined; isPending: boolean; isFetching?: boolean; error: Error | null }
const q = <T,>(data: T): Q<T> => ({ data, isPending: false, error: null })

let plans: Q<AppPlan[]>
let releases: AppRelease[]
let instances: AppInstance[]
let check: Q<AppRolloutCheck>
let backups: InstanceBackup[]
const start = vi.fn()
const control = vi.fn()
const stepControl = vi.fn()
const backUp = vi.fn()
const restore = vi.fn()
const teamMutate = vi.fn()
const mutation = (mutate: ReturnType<typeof vi.fn>) => ({
  mutate,
  reset: vi.fn(),
  isPending: false,
  error: null,
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/modules/shared/hooks/use-person-name', () => ({
  usePersonName: (v: string) => ({
    name: v === '0xaaa' ? 'Frank' : null,
    avatarUrl: null,
    address: v,
  }),
}))
vi.mock('../hooks/use-apps', () => ({
  useAppPlans: () => plans,
  useAppReleases: () => q(releases),
  useAppInstances: () => q(instances),
  useAppRollouts: () => q([]),
  useCheckRollout: () => check,
  useStartRollout: () => mutation(start),
  useControlRollout: () => mutation(control),
  useControlRolloutStep: () => mutation(stepControl),
  useInstanceBackups: () => q(backups),
  useInstanceRestores: () => q([]),
  useBackUpInstance: () => mutation(backUp),
  useRestoreInstanceBackup: () => mutation(restore),
  useTeamPlan: () => mutation(teamMutate),
  useUpdateAppPlan: () => mutation(vi.fn()),
}))

import { InstanceBackups } from '../components/instance-backups'
import { RolloutView } from '../components/app-rollouts'
import { RolloutDialog } from '../components/rollout-dialog'
import { TeamPlanCard } from '../components/team-plan-card'

const plan = (over: Partial<AppPlan> = {}) =>
  ({
    id: 'p1',
    name: 'Pro',
    kind: 'pro',
    access: 'own',
    status: 'active',
    targetVersion: '1.2.0',
    policy: 'manual',
    ...over,
  }) as AppPlan
const release = (version: string, over: Partial<AppRelease> = {}) =>
  ({ version, kind: 'release', migrates: false, ...over }) as AppRelease

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  plans = q([plan(), plan({ id: 'p2', name: 'Basic', kind: 'basic' })])
  releases = [release('1.3.0'), release('1.2.0'), release('1.4.0', { withdrawnAt: 'x' })]
  instances = []
  backups = []
  check = q({
    version: '1.3.0',
    ok: true,
    problems: [],
    steps: [
      {
        instanceId: 'i1',
        instanceName: 'pro-1',
        instanceKind: 'own',
        planId: 'p1',
        fromVersion: '1.2.0',
        status: 'pending',
        note: null,
        dueAt: '2026-11-15T10:00:00Z',
      },
    ],
  })
})

describe('RolloutDialog', () => {
  const open = () =>
    render(<RolloutDialog appId="a1" open onOpenChange={vi.fn()} initialPlanId="p1" />)

  it('hides withdrawn releases and ticks the clicked plan', () => {
    open()
    const options = within(screen.getByLabelText('Release')).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Pick a release', '1.3.0', '1.2.0'])
    expect((screen.getByRole('checkbox', { name: 'Pro' }) as HTMLInputElement).dataset.state).toBe(
      'checked',
    )
    expect(screen.getByRole('checkbox', { name: 'Basic' }).dataset.state).toBe('unchecked')
  })

  it('lists the steps in order with their due dates and starts when the check passes', () => {
    open()
    fireEvent.change(screen.getByLabelText('Release'), { target: { value: '1.3.0' } })
    const row = screen.getByTestId('check-step-i1')
    expect(row.textContent).toContain('pro-1')
    expect(row.textContent).toContain('1.2.0 → 1.3.0')
    expect(row.textContent).toContain('due')
    const button = screen.getByRole('button', { name: 'Start rollout' })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)
    expect(start).toHaveBeenCalledWith(
      { version: '1.3.0', planIds: ['p1'], noticeHours: null },
      expect.anything(),
    )
  })

  it('shows every problem and disables Start while the check fails', () => {
    check = q({ version: '1.3.0', ok: false, problems: ['Not healthy on Team yet'], steps: [] })
    open()
    fireEvent.change(screen.getByLabelText('Release'), { target: { value: '1.3.0' } })
    expect(screen.getByText('Not healthy on Team yet')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Start rollout' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})

function rollout(over: Partial<AppRollout> = {}): AppRollout {
  return {
    id: 'r1',
    appId: 'a1',
    version: '1.3.0',
    status: 'active',
    direction: 'forward',
    source: 'console',
    startedBy: '0xaaa',
    startedAt: '2026-11-13T10:00:00Z',
    notes: null,
    pausedAt: null,
    pausedReason: null,
    finishedAt: null,
    rolledBackBy: null,
    rolledBackAt: null,
    plans: [{ planId: 'p1', fromVersion: '1.2.0', noticeHours: 72 }],
    steps: [
      {
        id: 's1',
        instanceId: 'i1',
        instanceName: 'pro-1',
        instanceKind: 'own',
        planId: 'p1',
        position: 0,
        fromVersion: '1.2.0',
        toVersion: '1.3.0',
        status: 'failed',
        dueAt: '2026-11-13T10:00:00Z',
        requestedAt: null,
        startedAt: null,
        finishedAt: null,
        attempts: 1,
        error: 'health check failed',
        note: null,
        backupId: 'b1',
      },
    ],
    ...over,
  }
}

describe('RolloutView', () => {
  const view = (r: AppRollout) =>
    render(<RolloutView appId="a1" rollout={r} canRelease onBack={vi.fn()} />)

  it('names who started it by Renown name, and shows the failed step with retry and skip', () => {
    instances = [{ id: 'i1', holder: '0xaaa' } as AppInstance]
    view(rollout())
    expect(screen.getAllByText('Frank').length).toBeGreaterThan(0)
    expect(screen.queryByText('0xaaa')).toBeNull()
    const step = screen.getByTestId('step-s1')
    expect(step.textContent).toContain('Failed')
    expect(step.textContent).toContain('health check failed')
    fireEvent.click(within(step).getByRole('button', { name: 'Retry' }))
    expect(stepControl).toHaveBeenCalledWith({ action: 'retryRolloutStep', stepId: 's1' })
    fireEvent.click(within(step).getByRole('button', { name: 'Skip' }))
    expect(stepControl).toHaveBeenLastCalledWith({ action: 'skipRolloutStep', stepId: 's1' })
  })

  it('pauses an active rollout', () => {
    view(rollout())
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(control).toHaveBeenCalledWith({ action: 'pauseRollout', rolloutId: 'r1' })
  })

  it('shows Vetra for a policy and the pause reason; resume waits for the failed step', () => {
    view(
      rollout({
        source: 'policy',
        startedBy: 'vetra',
        status: 'paused',
        pausedReason: 'unhealthy',
      }),
    )
    expect(screen.getByText('Vetra (policy)')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('unhealthy')
    expect((screen.getByRole('button', { name: 'Resume' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('rolls a migrating release back only after the data loss is accepted', () => {
    releases = [release('1.3.0', { migrates: true })]
    view(rollout({ status: 'complete', steps: [{ ...rollout().steps[0], status: 'succeeded' }] }))
    fireEvent.click(screen.getByRole('button', { name: 'Roll back' }))
    const confirm = screen.getAllByRole('button', { name: 'Roll back' }).at(-1) as HTMLButtonElement
    expect(screen.getByText(/Data written since each backup is lost/)).toBeTruthy()
    expect(confirm.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    expect(control).toHaveBeenCalledWith(
      { action: 'rollBackRollout', rolloutId: 'r1', acceptDataLoss: true },
      expect.anything(),
    )
  })
})

const inst = (over: Partial<AppInstance> = {}) =>
  ({
    id: 'i1',
    kind: 'own',
    name: 'pro-1',
    status: 'ready',
    runningVersion: '1.2.0',
    maintenance: null,
    ...over,
  }) as AppInstance

const backup = (over: Partial<InstanceBackup> = {}): InstanceBackup => ({
  id: 'b1',
  instanceId: 'i1',
  reason: 'pre_update',
  status: 'ready',
  version: '1.2.0',
  sizeBytes: 2048,
  error: null,
  requestedBy: 'vetra',
  createdAt: '2026-11-13T09:00:00Z',
  finishedAt: null,
  expiresAt: '2026-12-13T09:00:00Z',
  rolloutStepId: null,
  ...over,
})

describe('InstanceBackups', () => {
  it('lists backups in words, with Vetra as the requester', () => {
    backups = [backup()]
    render(<InstanceBackups appId="a1" instance={inst()} canRelease />)
    const row = screen.getByTestId('backup-b1')
    expect(row.textContent).toContain('Before update 1.2.0')
    expect(row.textContent).toContain('2.0 KB')
    expect(row.textContent).toContain('Vetra')
  })

  it('backs up now', () => {
    render(<InstanceBackups appId="a1" instance={inst()} canRelease />)
    fireEvent.click(screen.getByRole('button', { name: 'Back up now' }))
    expect(backUp).toHaveBeenCalled()
  })

  it('offers Restore only for a ready backup of the running release', () => {
    backups = [
      backup(),
      backup({ id: 'b2', version: '1.1.0' }),
      backup({ id: 'b3', status: 'failed' }),
    ]
    render(<InstanceBackups appId="a1" instance={inst()} canRelease />)
    expect(
      within(screen.getByTestId('backup-b1')).getByRole('button', { name: 'Restore' }),
    ).toBeTruthy()
    expect(within(screen.getByTestId('backup-b2')).queryByRole('button')).toBeNull()
    expect(within(screen.getByTestId('backup-b3')).queryByRole('button')).toBeNull()
  })

  it('restores only after the instance name is typed, accepting the data loss', () => {
    backups = [backup()]
    render(<InstanceBackups appId="a1" instance={inst()} canRelease />)
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(screen.getByText(/Everything\s+written since is lost/)).toBeTruthy()
    const go = screen.getByRole('button', {
      name: /Restore and lose newer data/,
    }) as HTMLButtonElement
    expect(go.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: 'pro-1' } })
    expect(go.disabled).toBe(false)
    fireEvent.click(go)
    expect(restore).toHaveBeenCalledWith('b1', expect.anything())
  })
})

describe('TeamPlanCard', () => {
  const app = { id: 'a1', ownerOrgId: 'org1', productionBranch: 'main', releaseBranches: ['next'] }

  it('turns Team on following a chosen branch', () => {
    plans = q([plan()])
    render(<TeamPlanCard app={app} canAdminister />)
    fireEvent.change(screen.getByLabelText('Branch to follow'), { target: { value: 'next' } })
    fireEvent.click(screen.getByRole('button', { name: 'Turn on Team' }))
    expect(teamMutate).toHaveBeenCalledWith(
      { enable: true, followBranch: 'next' },
      expect.anything(),
    )
  })

  it('explains Team on a personal app and offers nothing', () => {
    render(<TeamPlanCard app={{ ...app, ownerOrgId: null }} canAdminister />)
    expect(screen.getByText(/Team is for organisation apps/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Turn on Team' })).toBeNull()
  })

  it('shows the instance and turns Team off after a confirmation', () => {
    plans = q([plan({ id: 'tp', name: 'Team', kind: null, team: true, policy: 'follow:main' })])
    instances = [inst({ id: 'ti', planId: 'tp', kind: 'shared', url: 'https://team.vetra.io' })]
    render(<TeamPlanCard app={app} canAdminister />)
    expect(screen.getByRole('link', { name: /team\.vetra\.io/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    expect(screen.getByText(/customer rollouts are no longer checked/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Turn off Team' }))
    expect(teamMutate).toHaveBeenCalledWith({ enable: false }, expect.anything())
  })
})
