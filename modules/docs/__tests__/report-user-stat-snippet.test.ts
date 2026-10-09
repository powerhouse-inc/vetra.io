import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { REPORT_USER_STAT_SNIPPET } from '../report-user-stat-snippet'

// sha256 of vetra-cloud-package shared/report-user-stat.ts (the unit-tested original).
// Update both together: the docs page shows this file verbatim.
const ORIGINAL_SHA256 = 'c91d4861b9dfa865983f8107946200db24518587a860f2a7e00b0b881e5f71ea'

describe('report-user-stat docs snippet', () => {
  it('is byte-identical to the vetra-cloud-package helper', () => {
    expect(createHash('sha256').update(REPORT_USER_STAT_SNIPPET).digest('hex')).toBe(ORIGINAL_SHA256)
  })
})
