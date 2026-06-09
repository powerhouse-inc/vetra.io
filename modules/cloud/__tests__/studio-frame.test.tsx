import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { StudioFrame } from '@/modules/cloud/studio/components/studio-frame'

describe('StudioFrame', () => {
  it('renders an iframe with the embed url and a new-tab link', () => {
    const url = 'https://vetra-agent.warm-newt-75.vetra.io/?user=did%3Aethr%3A0xabc'
    const { container } = render(<StudioFrame embedUrl={url} />)
    const iframe = container.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toBe(url)
    const link = container.querySelector('a[target="_blank"]')
    expect(link?.getAttribute('href')).toBe(url)
  })
})
