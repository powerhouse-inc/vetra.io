import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCard } from '@/modules/cloud/components/metric-card'

const series = (value: number) => [
  {
    label: 'switchboard-0',
    datapoints: [
      { timestamp: 1000, value: value / 2 },
      { timestamp: 1060, value },
    ],
  },
]

describe('MetricCard size recommendation', () => {
  it('recommends the next size when usage is close to the quota', () => {
    render(<MetricCard title="CPU Usage" series={series(0.9)} kind="cpu" quota={1} />)
    expect(screen.getByText(/We recommend the next size up/)).toBeTruthy()
  })

  it('stays quiet with room to spare', () => {
    render(<MetricCard title="CPU Usage" series={series(0.2)} kind="cpu" quota={1} />)
    expect(screen.queryByText(/We recommend the next size up/)).toBeNull()
  })
})
