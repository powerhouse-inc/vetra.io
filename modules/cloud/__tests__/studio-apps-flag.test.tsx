import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import { StudioProductCard } from '@/modules/cloud/studio/components/studio-product-card'
import type { StudioProduct } from '@/modules/cloud/studio/use-studio-products'
import { studioAppsEnabled } from '@/modules/cloud/switchboard-url'

vi.mock('@/modules/apps/hooks/use-apps', () => ({
  useCreateStudioApp: () => ({}),
  useMyApps: () => ({ data: [] }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/modules/cloud/studio/use-studio-llm-status', () => ({ useStudioLlmStatus: () => ({}) }))
vi.mock('@/modules/cloud/studio/use-studio-llm-usage', () => ({ useStudioLlmUsage: () => ({}) }))

type WindowWithEnv = { __ENV?: Record<string, string> }

function setFlag(value: string | undefined) {
  const w = window as unknown as WindowWithEnv
  w.__ENV = value === undefined ? {} : { NEXT_PUBLIC_STUDIO_APPS_ENABLED: value }
}

afterEach(() => {
  delete (window as unknown as WindowWithEnv).__ENV
})

const product: StudioProduct = {
  envId: 'env1',
  subdomain: 'sub',
  prefix: 'vetra-agent',
  label: 'Vetra Studio',
  brand: { title: 'Concord', tagline: '', description: '' },
  status: 'ready',
}

describe('studioAppsEnabled', () => {
  it('is off unless the deployment sets "true"', () => {
    setFlag(undefined)
    expect(studioAppsEnabled()).toBe(false)
    setFlag('1')
    expect(studioAppsEnabled()).toBe(false)
    setFlag('true')
    expect(studioAppsEnabled()).toBe(true)
  })

  it('hides "Make it an App" on Studio cards while off', () => {
    setFlag(undefined)
    const { queryByText } = render(
      <StudioProductCard product={product} href="https://x.vetra.io" />,
    )
    expect(queryByText('Make it an App')).toBeNull()
  })

  it('shows "Make it an App" on a ready Studio card when on', () => {
    setFlag('true')
    const { getByText } = render(<StudioProductCard product={product} href="https://x.vetra.io" />)
    getByText('Make it an App')
  })
})
