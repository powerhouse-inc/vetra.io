import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentsSection } from '@/modules/cloud/components/agents-section'
import type { CloudEnvironmentService } from '@/modules/cloud/types'

const clint = (prefix: string): CloudEnvironmentService => ({
  type: 'CLINT',
  prefix,
  enabled: true,
  url: null,
  status: 'ACTIVE',
  version: null,
  config: {
    package: { registry: 'r', name: 'ph-' + prefix, version: '1.0.0' },
    env: [],
    serviceCommand: null,
    selectedRessource: 'VETRA_AGENT_S',
  },
  selectedRessource: 'VETRA_AGENT_S',
})

const nonClint: CloudEnvironmentService = {
  type: 'CONNECT',
  prefix: 'connect',
  enabled: true,
  url: null,
  status: 'ACTIVE',
  version: null,
  selectedRessource: 'VETRA_AGENT_S',
}

describe('AgentsSection', () => {
  it('renders empty state when no CLINT services', () => {
    render(<AgentsSection services={[nonClint]} env={null} canEdit={false} tenantId={null} />)
    expect(screen.queryByText(/install your first agent/i)).not.toBeNull()
  })

  it('renders one card per CLINT service, sorted by prefix', () => {
    render(
      <AgentsSection
        services={[clint('zeta'), clint('alpha')]}
        env={null}
        canEdit={false}
        tenantId={null}
      />,
    )
    const headings = screen.getAllByText(/^ph-/)
    expect(headings).toHaveLength(2)
    expect(headings[0].textContent).toContain('alpha')
    expect(headings[1].textContent).toContain('zeta')
  })

  it('shows "Add Agent" CTA in header and empty-state when canEdit', () => {
    render(<AgentsSection services={[]} env={null} canEdit tenantId={null} />)
    // Header CTA + empty-state CTA — two buttons.
    expect(screen.queryAllByRole('button', { name: /add agent/i }).length).toBe(2)
  })

  it('hides "Add Agent" CTA when !canEdit', () => {
    render(<AgentsSection services={[]} env={null} canEdit={false} tenantId={null} />)
    expect(screen.queryByRole('button', { name: /add agent/i })).toBeNull()
  })
})
