import { describe, expect, it } from 'vitest'
import { parseBrandSheet, type ProductBrand } from '@/modules/cloud/studio/fetch-product-brand'

const ok = {
  data: {
    BrandSheet: {
      documents: {
        items: [
          {
            id: '1',
            name: 'doc',
            state: {
              global: {
                name: 'Concord',
                maxim: 'Share the burden.',
                concept: 'Concord coordinates procurement…',
              },
            },
          },
        ],
      },
    },
  },
}

describe('parseBrandSheet', () => {
  it('extracts title/tagline/description from the first item', () => {
    expect(parseBrandSheet(ok)).toEqual<ProductBrand>({
      title: 'Concord',
      tagline: 'Share the burden.',
      description: 'Concord coordinates procurement…',
    })
  })
  it('returns null when there are no items', () => {
    expect(parseBrandSheet({ data: { BrandSheet: { documents: { items: [] } } } })).toBeNull()
  })
  it('returns null for GraphQL errors / malformed payload', () => {
    expect(parseBrandSheet({ errors: [{ message: 'nope' }] })).toBeNull()
    expect(parseBrandSheet(null)).toBeNull()
    expect(parseBrandSheet({ data: {} })).toBeNull()
  })
  it('tolerates missing maxim/concept (null), keeps title', () => {
    const r = parseBrandSheet({
      data: { BrandSheet: { documents: { items: [{ state: { global: { name: 'X' } } }] } } },
    })
    expect(r).toEqual<ProductBrand>({ title: 'X', tagline: null, description: null })
  })
})
