import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { CloudEnvironment, CloudEnvironmentService } from '@/modules/cloud/types'

vi.mock('@/modules/cloud/hooks/use-environment-org', () => ({
  useCanEditEnvironment: () => false,
}))
vi.mock('@/modules/cloud/hooks/use-tenant-config', () => ({
  useTenantConfig: () => ({ setSecret: vi.fn() }),
}))
vi.mock('@/modules/cloud/hooks/use-clint-packages', () => ({
  useClintPackages: () => ({ clintPackages: [], isLoading: false }),
}))
vi.mock('@/modules/cloud/hooks/use-clint-runtime-endpoints', () => ({
  useClintRuntimeEndpoints: () => ({ byPrefix: {} }),
}))
// The sections below the Services card fetch on their own; not under test here.
vi.mock('@/modules/cloud/components/packages-section', () => ({ PackagesSection: () => null }))
vi.mock('@/modules/cloud/components/agents-section', () => ({ AgentsSection: () => null }))
vi.mock('@/modules/cloud/components/add-agent-modal', () => ({ AddAgentModal: () => null }))
vi.mock('@/modules/cloud/components/fusion-config-dialog', () => ({
  FusionConfigDialog: () => null,
}))

import { OverviewTab } from '@/app/user/environments/[project]/tabs/overview'

function svc(type: CloudEnvironmentService['type'], prefix: string): CloudEnvironmentService {
  return {
    type,
    prefix,
    enabled: true,
    url: null,
    status: 'ACTIVE',
    version: null,
    selectedRessource: null,
  }
}

const environment = {
  id: 'env-1',
  state: {
    owner: null,
    label: 'demo',
    status: 'READY',
    services: [
      svc('CONNECT', 'connect'),
      svc('SWITCHBOARD', 'switchboard'),
      svc('CLINT', 'rupert'),
    ],
    packages: [{ registry: 'https://r', name: '@acme/invoices', version: '1.0.0' }],
  },
} as unknown as CloudEnvironment

function renderOverview(onOpenAgentDetail = vi.fn()) {
  render(
    <OverviewTab
      subdomain="demo"
      tenantId={null}
      environment={environment}
      status={null}
      statusLoading={false}
      enableService={vi.fn()}
      disableService={vi.fn()}
      addPackage={vi.fn()}
      removePackage={vi.fn()}
      onOpenAgentDetail={onOpenAgentDetail}
    />,
  )
  return { onOpenAgentDetail }
}

describe('Services card List / Map toggle', () => {
  it('defaults to the list and switches to the map with node labels', () => {
    renderOverview()
    expect(screen.getByRole('button', { name: 'list' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('group', { name: 'Environment topology' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'map' }))

    expect(screen.getByRole('group', { name: 'Environment topology' })).not.toBeNull()
    expect(screen.getByText('Connect', { selector: 'text' })).not.toBeNull()
    expect(screen.getByText('Switchboard', { selector: 'text' })).not.toBeNull()
    expect(screen.getByText('Agent: rupert', { selector: 'text' })).not.toBeNull()
    expect(screen.getByText('Database', { selector: 'text' })).not.toBeNull()
    expect(screen.getByText('@acme/invoices@1.0.0', { selector: 'text' })).not.toBeNull()
  })

  it('opens the agent drawer when its node is clicked', () => {
    const { onOpenAgentDetail } = renderOverview()
    fireEvent.click(screen.getByRole('button', { name: 'map' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Agent: rupert details' }))
    expect(onOpenAgentDetail).toHaveBeenCalledWith('rupert')
  })
})
