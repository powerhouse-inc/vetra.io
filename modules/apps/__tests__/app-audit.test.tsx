import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppAuditEntry } from '../types'

type AuditState = {
  data: { pages: { entries: AppAuditEntry[]; nextBefore: string | null }[] } | undefined
  isPending: boolean
  error: Error | null
  hasNextPage: boolean
}
let state: AuditState
const fetchNextPage = vi.fn()

vi.mock('../hooks/use-apps', () => ({
  useAppAudit: () => ({
    ...state,
    fetchNextPage,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    refetch: vi.fn(),
    isRefetching: false,
  }),
}))
vi.mock('@/modules/shared/components/person-name', () => ({
  PersonName: ({ value }: { value: string }) => (
    <span>{value === FRANK ? 'Frank' : value === ANNA ? 'Anna' : 'someone'}</span>
  ),
}))

const FRANK = '0x' + 'f'.repeat(40)
const ANNA = '0x' + 'a'.repeat(40)

import { AppAudit } from '../components/app-audit'

function entry(over: Partial<AppAuditEntry> & { detail?: unknown } = {}): AppAuditEntry {
  const { detail, ...rest } = over
  return {
    id: 'e1',
    appId: 'app-1',
    at: new Date(Date.now() - 3_600_000).toISOString(),
    actor: FRANK,
    source: 'console',
    action: 'plan.target_set',
    subject: 'plan:p1',
    ...rest,
    detail: JSON.stringify(detail ?? { slug: 'pro', from: '1.4.0', to: '1.5.0' }),
  }
}

const page = (entries: AppAuditEntry[], nextBefore: string | null = null) => ({
  data: { pages: [{ entries, nextBefore }] },
  isPending: false,
  error: null,
  hasNextPage: nextBefore !== null,
})

describe('AppAudit', () => {
  beforeEach(() => {
    cleanup()
    fetchNextPage.mockReset()
  })

  it('shows who, where and what for each row, people by Renown name', () => {
    state = page([
      entry(),
      entry({
        id: 'e2',
        action: 'role.granted',
        subject: `role:${ANNA}`,
        detail: { address: ANNA, role: 'release_manager' },
      }),
      entry({
        id: 'e3',
        actor: 'vetra',
        source: 'system',
        action: 'instance.status',
        subject: 'instance:i1',
        detail: { name: 'main', from: 'updating', to: 'ready' },
      }),
      entry({
        id: 'e4',
        source: 'ci',
        action: 'release.recorded',
        subject: 'release:1.5.0',
        detail: { version: '1.5.0', branch: 'main', githubActor: 'octocat' },
      }),
    ])
    render(<AppAudit appId="app-1" />)
    const row = (id: string) => screen.getByTestId(`audit-${id}`).textContent
    expect(row('e1')).toContain('Frank')
    expect(row('e1')).toContain('Console')
    expect(row('e1')).toContain('retargeted pro from 1.4.0 to 1.5.0')
    expect(row('e2')).toContain('named Anna release manager')
    expect(row('e3')).toContain('Vetra')
    expect(row('e3')).toContain('instance main: updating → ready')
    expect(row('e4')).toContain('via GitHub Actions (octocat)')
    expect(row('e4')).toContain('CI')
    expect(screen.queryByText(FRANK)).toBeNull()
  })

  it('shows the exact time on hover and the detail on demand', () => {
    const e = entry()
    state = page([e])
    render(<AppAudit appId="app-1" />)
    expect(screen.getByText('1 hour ago').getAttribute('title')).toBeTruthy()
    expect(screen.queryByText(/"from": "1.4.0"/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText(/"from": "1.4.0"/)).toBeTruthy()
  })

  it('loads older entries with Load more', () => {
    state = page([entry()], 'cursor-1')
    render(<AppAudit appId="app-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
    cleanup()
    state = page([entry()])
    render(<AppAudit appId="app-1" />)
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('filters by kind', () => {
    state = page([
      entry(),
      entry({
        id: 'e2',
        action: 'setting.deleted',
        subject: 'setting:ALL/X',
        detail: { name: 'X', scope: 'ALL' },
      }),
    ])
    render(<AppAudit appId="app-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.queryByTestId('audit-e1')).toBeNull()
    expect(screen.getByTestId('audit-e2')).toBeTruthy()
  })

  it('says when nothing is recorded', () => {
    state = page([])
    render(<AppAudit appId="app-1" />)
    expect(screen.getByText('Nothing recorded yet')).toBeTruthy()
  })
})
