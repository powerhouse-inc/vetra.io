import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { REPORT_USER_STAT_SNIPPET } from '@/modules/docs/report-user-stat-snippet'
import AppStatsDocsPage from '../page'

afterEach(() => cleanup())

describe('/docs/app-stats', () => {
  it('documents the variables, the header, the mutation and the semantics', () => {
    render(<AppStatsDocsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Report app stats' })).toBeTruthy()
    for (const text of ['VETRA_REPORTING_TOKEN', 'VETRA_LICENSING_URL', 'x-vetra-reporting-token']) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0)
    }
    expect(screen.getByText(/current value, not an increment/i)).toBeTruthy()
    for (const id of ['how-it-works', 'declare', 'environment', 'report', 'semantics', 'helper', 'troubleshooting']) {
      expect(document.getElementById(id)).not.toBeNull()
    }
    expect(screen.getByRole('link', { name: /Open your apps/ }).getAttribute('href')).toBe('/user/apps')
  })

  it('ships the tested helper verbatim', () => {
    expect(REPORT_USER_STAT_SNIPPET).toContain('export async function reportUserStat(')
    expect(REPORT_USER_STAT_SNIPPET).toContain('"x-vetra-reporting-token": token')
    expect(REPORT_USER_STAT_SNIPPET).toContain('vetraLicensing { reportUserStat(user: $user, metric: $metric, value: $value) }')
  })
})
