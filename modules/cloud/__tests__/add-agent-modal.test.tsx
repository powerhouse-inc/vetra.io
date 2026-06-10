import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  AddAgentModal,
  type AddAgentSubmitPayload,
} from '@/modules/cloud/components/add-agent-modal'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { useRegistryManifest, useRegistryPackages } from '@/modules/cloud/hooks/use-registry-search'

vi.mock('@/modules/cloud/hooks/use-registry-search', () => ({
  useRegistryPackages: vi.fn(() => ({ packages: [], isLoading: false })),
  useRegistryVersions: vi.fn(() => ({ info: null, isLoading: false })),
  useRegistryManifest: vi.fn(() => ({ manifest: null, isLoading: false, error: null })),
  useRegistryManifests: vi.fn(() => ({ manifests: [], isLoading: false })),
}))

vi.mock('@/modules/cloud/hooks/use-tenant-config', () => ({
  useTenantConfig: () => ({ envVars: [], secrets: [] }),
}))

vi.mock('@powerhousedao/reactor-browser', () => ({
  useRenown: () => null,
}))

const fakeEnv: CloudEnvironment = {
  id: 'env-doc-1',
  name: 'env-doc-1',
  documentType: 'vetra-cloud-environment',
  revision: 0,
  createdAtUtcIso: '2024-01-01T00:00:00Z',
  lastModifiedAtUtcIso: '2024-01-01T00:00:00Z',
  state: {
    owner: null,
    label: 'Test',
    status: 'READY',
    services: [],
    packages: [],
    customDomain: null,
    apexService: null,
    autoUpdateChannel: null,
    genericSubdomain: 'test',
    genericBaseDomain: 'vetra.io',
    defaultPackageRegistry: 'https://registry.dev.vetra.io',
  },
}

describe('AddAgentModal', () => {
  it('renders dialog with title when open', () => {
    render(
      <AddAgentModal
        open
        onOpenChange={() => {}}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId={null}
        installedPackages={[]}
        onSubmit={async () => {}}
      />,
    )
    expect(screen.queryByText(/add agent/i)).not.toBeNull()
  })

  it('renders the empty-results state for the package picker', () => {
    render(
      <AddAgentModal
        open
        onOpenChange={() => {}}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId={null}
        installedPackages={[]}
        onSubmit={async () => {}}
      />,
    )
    expect(screen.queryByText(/no agents found/i)).not.toBeNull()
  })

  it('renders manifest-not-clint error when type is wrong', () => {
    vi.mocked(useRegistryPackages).mockReturnValue({
      packages: [{ name: '@x/foo-cli', version: '1.0.0', description: null }],
      isLoading: false,
    })
    vi.mocked(useRegistryManifest).mockReturnValue({
      manifest: { name: '@x/foo-cli', type: 'doc-model' },
      isLoading: false,
      error: null,
    })
    render(
      <AddAgentModal
        open
        onOpenChange={() => {}}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId={null}
        installedPackages={[]}
        onSubmit={async () => {}}
        defaultSelectedPackage="@x/foo-cli"
      />,
    )
    expect(screen.queryByText(/isn['']t a powerhouse agent/i)).not.toBeNull()
  })

  it('renders agent preview when manifest is clint-project', () => {
    vi.mocked(useRegistryPackages).mockReturnValue({
      packages: [{ name: '@x/foo-cli', version: '1.0.0', description: null }],
      isLoading: false,
    })
    vi.mocked(useRegistryManifest).mockReturnValue({
      manifest: {
        name: '@x/foo-cli',
        type: 'clint-project',
        features: { agent: { id: 'foo', name: 'Foo Agent', description: 'does foo' } },
      },
      isLoading: false,
      error: null,
    })
    render(
      <AddAgentModal
        open
        onOpenChange={() => {}}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId={null}
        installedPackages={[]}
        onSubmit={async () => {}}
        defaultSelectedPackage="@x/foo-cli"
      />,
    )
    expect(screen.queryByText('Foo Agent')).not.toBeNull()
    expect(screen.queryByText('does foo')).not.toBeNull()
  })

  it('defaults the prefix to the agent id and resource size to first supported', () => {
    vi.mocked(useRegistryPackages).mockReturnValue({
      packages: [{ name: '@x/foo-cli', version: '1.0.0', description: null }],
      isLoading: false,
    })
    vi.mocked(useRegistryManifest).mockReturnValue({
      manifest: {
        name: '@x/foo-cli',
        type: 'clint-project',
        features: { agent: { id: 'foo', name: 'Foo' } },
        supportedResources: ['vetra-agent-m', 'vetra-agent-l'],
        serviceCommand: 'foo --run',
      },
      isLoading: false,
      error: null,
    })
    render(
      <AddAgentModal
        open
        onOpenChange={() => {}}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId={null}
        installedPackages={[]}
        onSubmit={async () => {}}
        defaultSelectedPackage="@x/foo-cli"
      />,
    )
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    expect((screen.getByLabelText(/prefix/i) as HTMLInputElement).value).toBe('foo')
    expect(screen.queryByText('Medium')).not.toBeNull() // first supported size label from ResourceSizePicker
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    expect((screen.getByLabelText(/service command/i) as HTMLTextAreaElement).value).toBe(
      'foo --run',
    )
  })

  it('renders the four SERVICE_* env vars in the System block', () => {
    vi.mocked(useRegistryPackages).mockReturnValue({
      packages: [{ name: '@x/foo-cli', version: '1.0.0', description: null }],
      isLoading: false,
    })
    vi.mocked(useRegistryManifest).mockReturnValue({
      manifest: {
        name: '@x/foo-cli',
        type: 'clint-project',
        features: { agent: { id: 'foo', name: 'Foo' } },
      },
      isLoading: false,
      error: null,
    })
    render(
      <AddAgentModal
        open
        onOpenChange={() => {}}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId={null}
        installedPackages={[]}
        onSubmit={async () => {}}
        defaultSelectedPackage="@x/foo-cli"
      />,
    )
    expect(screen.queryByText('SERVICE_ANNOUNCE_URL')).not.toBeNull()
    expect(screen.queryByText('SERVICE_ANNOUNCE_TOKEN')).not.toBeNull()
    expect(screen.queryByText('SERVICE_DOCUMENT_ID')).not.toBeNull()
    expect(screen.queryByText('SERVICE_PREFIX')).not.toBeNull()
    expect(screen.queryByText('env-doc-1')).not.toBeNull() // SERVICE_DOCUMENT_ID preview = fakeEnv.id
  })

  it('renders manifest config entries via PackageConfigForm', () => {
    vi.mocked(useRegistryPackages).mockReturnValue({
      packages: [{ name: '@x/foo-cli', version: '1.0.0', description: null }],
      isLoading: false,
    })
    vi.mocked(useRegistryManifest).mockReturnValue({
      manifest: {
        name: '@x/foo-cli',
        type: 'clint-project',
        features: { agent: { id: 'foo', name: 'Foo' } },
        config: [
          { name: 'MODEL', type: 'var', default: 'm-1' },
          { name: 'API_KEY', type: 'secret', required: true },
        ],
      },
      isLoading: false,
      error: null,
    })
    render(
      <AddAgentModal
        open
        onOpenChange={() => {}}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId="tenant-1"
        installedPackages={[]}
        onSubmit={async () => {}}
        defaultSelectedPackage="@x/foo-cli"
      />,
    )
    expect(screen.queryByText('MODEL')).not.toBeNull()
    expect(screen.queryByText('API_KEY')).not.toBeNull()
  })

  it('blocks submit when a custom env var name collides with a SERVICE_* var', () => {
    vi.mocked(useRegistryManifest).mockReturnValue({
      manifest: {
        name: '@x/foo-cli',
        type: 'clint-project',
        features: { agent: { id: 'foo', name: 'Foo' } },
        supportedResources: ['vetra-agent-s'],
      },
      isLoading: false,
      error: null,
    })
    vi.mocked(useRegistryPackages).mockReturnValue({
      packages: [{ name: '@x/foo-cli', version: '1.0.0', description: null }],
      isLoading: false,
    })
    const onSubmit = vi.fn()
    render(
      <AddAgentModal
        open
        onOpenChange={() => {}}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId={null}
        installedPackages={[]}
        onSubmit={onSubmit}
        defaultSelectedPackage="@x/foo-cli"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add env var/i }))
    fireEvent.change(screen.getByLabelText('env-name-0'), { target: { value: 'SERVICE_PREFIX' } })
    fireEvent.change(screen.getByLabelText('env-value-0'), { target: { value: 'oops' } })
    fireEvent.click(screen.getByRole('button', { name: /install agent/i }))
    expect(screen.queryByText(/reserved/i)).not.toBeNull()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with packageName, version, prefix, clintConfig in order', async () => {
    vi.mocked(useRegistryManifest).mockReturnValue({
      manifest: {
        name: '@x/foo-cli',
        type: 'clint-project',
        features: { agent: { id: 'foo', name: 'Foo' } },
        supportedResources: ['vetra-agent-s'],
      },
      isLoading: false,
      error: null,
    })
    vi.mocked(useRegistryPackages).mockReturnValue({
      packages: [{ name: '@x/foo-cli', version: '1.0.0', description: null }],
      isLoading: false,
    })
    const onSubmit = vi.fn<(payload: AddAgentSubmitPayload) => Promise<void>>(async () => {})
    const onOpenChange = vi.fn()
    render(
      <AddAgentModal
        open
        onOpenChange={onOpenChange}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId={null}
        installedPackages={[]}
        onSubmit={onSubmit}
        defaultSelectedPackage="@x/foo-cli"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /install agent/i }))
    await new Promise((r) => setTimeout(r, 10))
    expect(onSubmit).toHaveBeenCalledOnce()
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.packageName).toBe('@x/foo-cli')
    expect(payload.prefix).toBe('foo')
    expect(payload.clintConfig.selectedRessource).toBe('VETRA_AGENT_S')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('allows install for an agent that declares no supportedResources', async () => {
    vi.mocked(useRegistryManifest).mockReturnValue({
      manifest: {
        name: '@x/foo-cli',
        type: 'clint-project',
        features: { agent: { id: 'foo', name: 'Foo' } },
        // no supportedResources — picker is hidden, size stays null
      },
      isLoading: false,
      error: null,
    })
    vi.mocked(useRegistryPackages).mockReturnValue({
      packages: [{ name: '@x/foo-cli', version: '1.0.0', description: null }],
      isLoading: false,
    })
    const onSubmit = vi.fn<(payload: AddAgentSubmitPayload) => Promise<void>>(async () => {})
    render(
      <AddAgentModal
        open
        onOpenChange={() => {}}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId={null}
        installedPackages={[]}
        onSubmit={onSubmit}
        defaultSelectedPackage="@x/foo-cli"
      />,
    )
    const installButton = screen.getByRole('button', { name: /install agent/i })
    expect((installButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(installButton)
    await new Promise((r) => setTimeout(r, 10))
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit.mock.calls[0][0].clintConfig.selectedRessource).toBeNull()
  })

  it('shows an error and stays open when onSubmit throws', async () => {
    vi.mocked(useRegistryManifest).mockReturnValue({
      manifest: {
        name: '@x/foo-cli',
        type: 'clint-project',
        features: { agent: { id: 'foo', name: 'Foo' } },
        supportedResources: ['vetra-agent-s'],
      },
      isLoading: false,
      error: null,
    })
    vi.mocked(useRegistryPackages).mockReturnValue({
      packages: [{ name: '@x/foo-cli', version: '1.0.0', description: null }],
      isLoading: false,
    })
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn(() => {
      throw new Error('addPackage failed')
    })
    render(
      <AddAgentModal
        open
        onOpenChange={onOpenChange}
        env={fakeEnv}
        registryUrl="https://registry.dev.vetra.io"
        tenantId={null}
        installedPackages={[]}
        onSubmit={onSubmit}
        defaultSelectedPackage="@x/foo-cli"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /install agent/i }))
    await new Promise((r) => setTimeout(r, 10))
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.queryByText(/addPackage failed/i)).not.toBeNull()
  })
})
