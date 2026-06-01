import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EnvVarsEditor } from '@/modules/cloud/components/env-vars-editor'

describe('EnvVarsEditor', () => {
  it('renders existing env vars', () => {
    render(<EnvVarsEditor value={[{ name: 'FOO', value: 'bar' }]} onChange={() => {}} />)
    expect((screen.getByLabelText('env-name-0')).value).toBe('FOO')
    expect((screen.getByLabelText('env-value-0')).value).toBe('bar')
  })

  it('adds a new empty row when "Add" clicked', () => {
    const onChange = vi.fn()
    render(<EnvVarsEditor value={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add env var/i }))
    expect(onChange).toHaveBeenCalledWith([{ name: '', value: '' }])
  })

  it('removes a row', () => {
    const onChange = vi.fn()
    render(
      <EnvVarsEditor
        value={[
          { name: 'A', value: '1' },
          { name: 'B', value: '2' },
        ]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: /remove env var/i })[0])
    expect(onChange).toHaveBeenCalledWith([{ name: 'B', value: '2' }])
  })

  it('updates a row name', () => {
    const onChange = vi.fn()
    render(<EnvVarsEditor value={[{ name: 'FOO', value: 'bar' }]} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('env-name-0'), { target: { value: 'BAZ' } })
    expect(onChange).toHaveBeenCalledWith([{ name: 'BAZ', value: 'bar' }])
  })
})
