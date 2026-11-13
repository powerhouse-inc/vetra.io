import { describe, expect, it, vi } from 'vitest'

import {
  backUpInstance,
  checkRollout,
  controlRollout,
  controlRolloutStep,
  disableTeamPlan,
  enableTeamPlan,
  fetchAppPlans,
  fetchAppReleases,
  fetchAppRollouts,
  fetchInstanceBackups,
  fetchMyInstances,
  pinInstance,
  removeMyInstanceCustomDomain,
  resetOptionalHolderFields,
  resetOptionalPlanFields,
  resetOptionalReleaseFields,
  restoreInstanceBackup,
  setMyInstanceCustomDomain,
  startRollout,
  unpinInstance,
  updateInstanceNow,
  withdrawRelease,
  type FetchLike,
} from '@/modules/apps/graphql'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const ok = (data: unknown) => vi.fn<FetchLike>(() => Promise.resolve(json({ data })))
function sent(f: ReturnType<typeof vi.fn<FetchLike>>, call = 0) {
  return JSON.parse(f.mock.calls[call][1].body as string) as {
    query: string
    variables: Record<string, unknown>
  }
}

describe('rollout operations', () => {
  it('lists rollouts with their steps', async () => {
    const f = ok({ appRollouts: [] })
    await fetchAppRollouts('a1', 20, 'tok', f)
    const { query, variables } = sent(f)
    expect(variables).toEqual({ appId: 'a1', limit: 20 })
    for (const field of ['steps', 'dueAt', 'pausedReason', 'backupId', 'restoreId'])
      expect(query).toContain(field)
  })

  it('checks a rollout with the plans and the notice', async () => {
    const check = { version: '1.3.0', ok: true, problems: [], steps: [] }
    const f = ok({ checkRollout: check })
    expect(await checkRollout('a1', '1.3.0', ['p1', 'p2'], 12, 'tok', f)).toEqual(check)
    expect(sent(f).variables).toEqual({
      appId: 'a1',
      version: '1.3.0',
      planIds: ['p1', 'p2'],
      noticeHours: 12,
    })
    expect(sent(f).query).toContain('problems')
  })

  it('starts a rollout with the input as given', async () => {
    const f = ok({ startRollout: { id: 'r1' } })
    const input = { appId: 'a1', version: '1.3.0', planIds: ['p1'], noticeHours: null }
    await startRollout(input, 'tok', f)
    expect(sent(f).query).toMatch(/startRollout\(input: \$input\)/)
    expect(sent(f).variables).toEqual({ input })
  })

  it('pauses with a reason and rolls back accepting data loss', async () => {
    const p = ok({ pauseRollout: { id: 'r1' } })
    await controlRollout('pauseRollout', 'r1', { reason: 'wait' }, 'tok', p)
    expect(sent(p).query).toMatch(/pauseRollout\(rolloutId: \$rolloutId, reason: \$reason\)/)
    expect(sent(p).variables).toEqual({ rolloutId: 'r1', reason: 'wait' })

    const b = ok({ rollBackRollout: { id: 'r1' } })
    await controlRollout('rollBackRollout', 'r1', { acceptDataLoss: true }, 'tok', b)
    expect(sent(b).query).toContain('acceptDataLoss: $acceptDataLoss')
    expect(sent(b).variables).toEqual({ rolloutId: 'r1', acceptDataLoss: true })

    const c = ok({ cancelRollout: { id: 'r1' } })
    await controlRollout('cancelRollout', 'r1', {}, 'tok', c)
    expect(sent(c).variables).toEqual({ rolloutId: 'r1' })
  })

  it('retries and skips a step by its id', async () => {
    const f = ok({ retryRolloutStep: { id: 'r1' } })
    await controlRolloutStep('retryRolloutStep', 's1', 'tok', f)
    expect(sent(f).query).toContain('retryRolloutStep(stepId: $stepId)')
    expect(sent(f).variables).toEqual({ stepId: 's1' })
  })

  it('pins, unpins, withdraws and updates now', async () => {
    const pin = ok({ pinInstance: { id: 'i1' } })
    await pinInstance('i1', '1.2.0', 'tok', pin)
    expect(sent(pin).variables).toEqual({ instanceId: 'i1', version: '1.2.0' })
    const unpin = ok({ unpinInstance: { id: 'i1' } })
    await unpinInstance('i1', 'tok', unpin)
    expect(sent(unpin).variables).toEqual({ instanceId: 'i1' })
    const w = ok({ withdrawRelease: { version: '1.3.0' } })
    await withdrawRelease('a1', '1.3.0', 'bad migration', 'tok', w)
    expect(sent(w).variables).toEqual({ appId: 'a1', version: '1.3.0', reason: 'bad migration' })
    const u = ok({ updateInstanceNow: { version: '1.3.0' } })
    await updateInstanceNow('i1', 'tok', u)
    expect(sent(u).query).toContain('updateInstanceNow(instanceId: $instanceId)')
  })
})

describe('backups, Team and holder operations', () => {
  it('lists backups and backs up now', async () => {
    const l = ok({ instanceBackups: [] })
    await fetchInstanceBackups('i1', 30, 'tok', l)
    expect(sent(l).variables).toEqual({ instanceId: 'i1', limit: 30 })
    const b = ok({ backUpInstance: { id: 'b1' } })
    await backUpInstance('i1', 'tok', b)
    expect(sent(b).query).toContain('backUpInstance(instanceId: $instanceId)')
  })

  it('restores sending the data loss acceptance', async () => {
    const f = ok({ restoreInstanceBackup: { id: 'r1' } })
    await restoreInstanceBackup('i1', 'b1', true, 'tok', f)
    expect(sent(f).variables).toEqual({ instanceId: 'i1', backupId: 'b1', acceptDataLoss: true })
  })

  it('turns Team on with a branch and off', async () => {
    resetOptionalPlanFields()
    const on = ok({ enableTeamPlan: { id: 'p1' } })
    await enableTeamPlan('a1', 'next', 'tok', on)
    expect(sent(on).variables).toEqual({ appId: 'a1', followBranch: 'next' })
    const off = ok({ disableTeamPlan: { id: 'p1' } })
    await disableTeamPlan('a1', 'tok', off)
    expect(sent(off).variables).toEqual({ appId: 'a1' })
  })

  it('sets and removes a custom domain', async () => {
    const s = ok({ setMyInstanceCustomDomain: { domain: 'x.com' } })
    await setMyInstanceCustomDomain('i1', 'x.com', 'tok', s)
    expect(sent(s).variables).toEqual({ instanceId: 'i1', domain: 'x.com' })
    expect(sent(s).query).toContain('records { type host value }')
    const r = ok({ removeMyInstanceCustomDomain: true })
    expect(await removeMyInstanceCustomDomain('i1', 'tok', r)).toBe(true)
  })
})

describe('optional fields', () => {
  const reject = (field: string, type: string) =>
    json({ errors: [{ message: `Cannot query field "${field}" on type "${type}".` }] })

  it('drops plan fields an older backend lacks and keeps the rest', async () => {
    resetOptionalPlanFields()
    const f = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(reject('warmPoolSize', 'AppPlan'))
      .mockResolvedValueOnce(json({ data: { appPlans: [] } }))
    await fetchAppPlans('a1', 'tok', f)
    expect(sent(f, 0).query).toContain('warmPoolSize')
    expect(sent(f, 1).query).not.toContain('warmPoolSize')
    expect(sent(f, 1).query).toContain('policyNote')
    resetOptionalPlanFields()
  })

  it('selects withdrawal and Team fields on releases', async () => {
    resetOptionalReleaseFields()
    const f = ok({ appReleases: [] })
    await fetchAppReleases('a1', 'release', 50, 'tok', f)
    for (const field of ['withdrawnAt', 'withdrawnReason', 'teamHealthyAt'])
      expect(sent(f).query).toContain(field)
  })

  it('selects the update, notices and custom domain of a holder instance', async () => {
    resetOptionalHolderFields()
    const f = ok({ myInstances: [] })
    await fetchMyInstances('tok', f)
    const { query } = sent(f)
    expect(query).toContain('update { rolloutId version dueAt notes paused canUpdateNow }')
    expect(query).toContain('notices { kind at message }')
    expect(query).toContain('customDomain {')
  })
})
