import { describe, expect, it } from 'vitest'

import { pageNumbers } from '../package-pagination'

describe('pageNumbers', () => {
  it('lists every page when there are few', () => {
    expect(pageNumbers(2, 3)).toEqual([1, 2, 3])
  })

  it('collapses distant pages into gaps', () => {
    expect(pageNumbers(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(pageNumbers(1, 10)).toEqual([1, 2, null, 10])
  })
})
