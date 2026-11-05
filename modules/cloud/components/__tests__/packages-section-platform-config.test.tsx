import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/modules/cloud/hooks/use-tenant-config', () => ({
  useTenantConfig: () => ({
    envVars: [
      { key: 'VETRA_MODEL', value: 'deepseek/deepseek-v4' },
      { key: 'MY_FLAG', value: 'on' },
    ],
    secrets: [{ key: 'VETRA_REPORTING_TOKEN' }, { key: 'MY_API_KEY' }],
    isLoading: false,
    setVar: vi.fn(),
    setSecret: vi.fn(),
    deleteVar: vi.fn(),
    deleteSecret: vi.fn(),
  }),
}))
vi.mock('@/modules/cloud/hooks/use-registry-search', () => ({
  useRegistryManifests: () => ({ manifests: [], isLoading: false }),
}))
vi.mock('@/modules/cloud/components/add-package-modal', () => ({ AddPackageModal: () => null }))

import { PackagesSection } from '../packages-section'

describe('PackagesSection config ownership', () => {
  it('lists platform keys read-only and only user keys as unused', () => {
    render(
      <PackagesSection
        tenantId="t1"
        registryUrl="https://registry.vetra.io"
        installedPackages={[]}
        modulePackages={[]}
        onAddPackage={vi.fn()}
        onRemovePackage={vi.fn()}
      />,
    )

    const unused = screen.getByText('Unused Config').closest('div.rounded-md') as HTMLElement
    expect(within(unused).getByText('MY_FLAG')).toBeTruthy()
    expect(within(unused).getByText('MY_API_KEY')).toBeTruthy()
    expect(within(unused).queryByText('VETRA_MODEL')).toBeNull()
    expect(within(unused).queryByText('VETRA_REPORTING_TOKEN')).toBeNull()

    const platform = screen.getByText('Set by Vetra').closest('details') as HTMLElement
    expect(within(platform).getByText('VETRA_MODEL')).toBeTruthy()
    expect(within(platform).getByText('VETRA_REPORTING_TOKEN')).toBeTruthy()
    expect(within(platform).queryAllByRole('button')).toHaveLength(0)
  })
})
