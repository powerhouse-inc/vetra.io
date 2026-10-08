import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { PublisherLicense, PublisherTerm, TemplateMode } from '../types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useReplaceGrant: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock(
  '@/modules/shared/components/ui/select',
  () => import('@/modules/shared/test/native-select'),
)

import { ChangePlanDialog } from '../components/holders/change-plan-dialog'

const term = (kind: string): PublisherTerm => ({
  id: kind,
  kind,
  label: kind,
  templateId: kind,
  validityDays: null,
  issuers: ['PUBLISHER_GRANT'],
  status: 'ACTIVE',
  activeLicenses: 0,
})
const terms = [term('pro'), term('team')]
const license = {
  id: 'l1',
  kind: 'pro',
  user: 'did:pkh:eip155:1:0xAbCdEf0123456789aBcDeF0123456789AbCdEf01',
} as PublisherLicense

function renderDialog(modes: Record<string, TemplateMode>) {
  render(
    <ChangePlanDialog
      appId="a"
      license={license}
      terms={terms}
      modeOf={(k) => modes[k] ?? null}
      onClose={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('New plan'), { target: { value: 'team' } })
}

describe('ChangePlanDialog', () => {
  beforeEach(() => {
    cleanup()
  })

  it('says the environment is kept only between two dedicated plans', () => {
    renderDialog({ pro: 'DEDICATED', team: 'DEDICATED' })
    expect(screen.getByText(/keeps their environment/i)).toBeTruthy()
  })

  it.each([
    ['shared target', { pro: 'DEDICATED', team: 'SHARED' }],
    ['shared current', { pro: 'SHARED', team: 'DEDICATED' }],
    ['unknown modes', {}],
  ] as const)('stays neutral for %s', (_n, modes) => {
    renderDialog({ ...modes })
    expect(screen.queryByText(/keeps their environment/i)).toBeNull()
    expect(screen.getByText(/access follows the new plan/i)).toBeTruthy()
  })

  it('scrolls on small screens', () => {
    renderDialog({})
    expect(screen.getByRole('dialog').className).toContain('max-h-[85vh]')
    expect(screen.getByRole('dialog').className).toContain('overflow-y-auto')
  })
})
