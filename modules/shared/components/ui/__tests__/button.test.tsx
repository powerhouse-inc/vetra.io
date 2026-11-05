import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { Button } from '../button'

describe('Button', () => {
  it('turns a disabled primary button neutral instead of half-opacity green', () => {
    render(<Button disabled>Save changes</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('disabled:bg-muted')
    expect(cls).toContain('disabled:text-muted-foreground')
    expect(cls).toContain('disabled:opacity-100')
    expect(cls).not.toContain('disabled:opacity-50')
  })

  it('keeps the fade for the other variants', () => {
    render(
      <Button disabled variant="outline">
        Cancel
      </Button>,
    )
    const cls = screen.getByRole('button').className
    expect(cls).toContain('disabled:opacity-50')
    expect(cls).not.toContain('disabled:bg-muted')
  })
})
