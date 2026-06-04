import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EnvVarsEditor } from '@/modules/cloud/components/env-vars-editor'

describe('EnvVarsEditor', () => {
  it('renders existing env vars', () => {
    render(<EnvVarsEditor value={[{ name: 'FOO', value: 'bar' }]} onChange={() => {}} />)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    expect((screen.getByLabelText('env-name-0') as HTMLInputElement).value).toBe('FOO')
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    expect((screen.getByLabelText('env-value-0') as HTMLInputElement).value).toBe('bar')
  })

  it('adds a new empty row when "Add" clicked', () => {
    const onChange = vi.fn()
    render(<EnvVarsEditor value={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add env var/i }))
    // New rows default to non-secret (isSecret=false); user opts into
    // encryption via the lock toggle.
    expect(onChange).toHaveBeenCalledWith([{ name: '', value: '', isSecret: false }])
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

  it('toggling the lock flips isSecret on that row', () => {
    const onChange = vi.fn()
    render(
      <EnvVarsEditor
        value={[{ name: 'API_KEY', value: 'plain', isSecret: false }]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'mark-secret-0' }))
    // The value is preserved on the toggle event itself; routeEnvVars
    // (called on submit by the parent) is what splits it into the
    // tenant_secrets write + clearing value=null in the document.
    expect(onChange).toHaveBeenCalledWith([
      { name: 'API_KEY', value: 'plain', isSecret: true },
    ])
  })

  it('masks the value input when isSecret is true', () => {
    render(
      <EnvVarsEditor
        value={[{ name: 'API_KEY', value: 'sk-...', isSecret: true }]}
        onChange={() => {}}
      />,
    )
    const input = screen.getByLabelText('env-value-0')
    expect(input.type).toBe('password')
  })

  it('shows the "encrypted — type to replace" placeholder for stored secrets', () => {
    render(
      <EnvVarsEditor
        value={[{ name: 'API_KEY', value: null, isSecret: true }]}
        onChange={() => {}}
      />,
    )
    const input = screen.getByLabelText('env-value-0')
    expect(input.placeholder).toContain('encrypted')
  })

  it('renders unlock icon button for non-secret rows', () => {
    render(
      <EnvVarsEditor
        value={[{ name: 'PUBLIC', value: 'visible', isSecret: false }]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'mark-secret-0' })).not.toBeNull()
  })

  it('renders lock icon button for secret rows', () => {
    render(
      <EnvVarsEditor
        value={[{ name: 'SECRET', value: '', isSecret: true }]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'unmark-secret-0' })).not.toBeNull()
  })
})
