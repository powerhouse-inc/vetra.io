import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@/modules/shared/components/renown/require-login', () => ({
  RequireLogin: ({ children }: { children: React.ReactNode }) => <div>login:{children}</div>,
}))
vi.mock('@/modules/studio-license/components/studio-license-gate', () => ({
  StudioLicenseGate: () => <div>studio-gate</div>,
}))
vi.mock('@/modules/apps/components/new-app-wizard', () => ({
  NewAppWizard: () => <div>wizard</div>,
}))

import NewAppPage from '../page'

describe('/user/apps/new', () => {
  it('needs a login, not a Studio licence', () => {
    const { container } = render(<NewAppPage />)
    expect(container.textContent).toBe('login:wizard')
    expect(screen.queryByText('studio-gate')).toBeNull()
  })
})
