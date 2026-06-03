import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentCard } from '@/modules/cloud/components/agent-card'
import type { CloudEnvironmentService, CloudPackage } from '@/modules/cloud/types'

const pkg: CloudPackage = { registry: 'https://r', name: 'ph-rupert', version: '1.2.3' }
const service: CloudEnvironmentService = {
  type: 'CLINT',
  prefix: 'rupert',
  enabled: true,
  url: null,
  status: 'ACTIVE',
  version: null,
  config: {
    package: pkg,
    env: [],
    serviceCommand: null,
    selectedRessource: 'VETRA_AGENT_XXL',
  },
  selectedRessource: 'VETRA_AGENT_XXL',
}

describe('AgentCard collapsed', () => {
  it('renders package label and resource size when no manifest', () => {
    render(<AgentCard service={service} env={null} canEdit={false} tenantId={null} />)
    expect(screen.queryByText(/ph-rupert@1\.2\.3/)).not.toBeNull()
    expect(screen.queryByText('rupert')).not.toBeNull()
    expect(screen.queryByText('2X-Large')).not.toBeNull()
  })

  it('prefers agent name + image from manifest features when available', () => {
    render(
      <AgentCard
        service={service}
        env={null}
        canEdit={false} tenantId={null}
        manifest={{
          name: 'ph-rupert',
          type: 'clint-project',
          features: {
            agent: { id: 'ph-rupert', name: 'Agent Rupert', image: 'https://x/a.png' },
          },
        }}
      />,
    )
    expect(screen.queryByText('Agent Rupert')).not.toBeNull()
    expect(screen.queryByAltText('Agent Rupert')).not.toBeNull()
  })

  it('hides Configure button when canEdit is false', () => {
    render(<AgentCard service={service} env={null} canEdit={false} tenantId={null} />)
    expect(screen.queryByRole('button', { name: /configure/i })).toBeNull()
  })

  it('shows Configure button when canEdit is true', () => {
    render(<AgentCard service={service} env={null} canEdit={true} tenantId={null} />)
    expect(screen.queryByRole('button', { name: /configure/i })).not.toBeNull()
  })

  it('renders unconfigured label when config is missing', () => {
    const noConfig: CloudEnvironmentService = { ...service, config: null }
    render(<AgentCard service={noConfig} env={null} canEdit={false} tenantId={null} />)
    expect(screen.queryByText(/unconfigured/i)).not.toBeNull()
  })
})
