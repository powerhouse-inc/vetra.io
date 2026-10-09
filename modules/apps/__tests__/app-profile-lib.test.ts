import { describe, expect, it, vi } from 'vitest'
import { fetchAppProfile } from '../lib/app-profile/api'
import {
  changedFields,
  fieldForServer,
  formFromProfile,
  formProblems,
  hasChanges,
  type AppProfileForm,
} from '../lib/app-profile/form'
import {
  cropRegion,
  IMAGE_SPECS,
  INITIAL_CROP,
  panBy,
  renderImage,
  sourceImageProblem,
} from '../lib/app-profile/image'
import { parseMarkdownLite } from '../lib/app-profile/markdown-lite'
import {
  appPageUrl,
  renownMediaUrl,
  renownPackageRoutes,
  renownStatsEndpoint,
} from '../lib/app-profile/renown'
import { ImageUploadError, uploadRenownImage } from '../lib/app-profile/upload'

const DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
const PROFILE = {
  appDid: DID,
  documentId: 'doc-9',
  name: 'Vault',
  tagline: 'Notes',
  logo: null,
  website: 'https://vault.example',
  publisherDid: null,
  description: 'Hi',
  category: 'Tools',
  logoRef: 'attachment://v1:aa',
  coverRef: null,
  links: [{ id: 'l1', label: 'Docs', url: 'https://docs.example' }],
}

describe('Renown URLs', () => {
  it('derives the stats endpoint, upload routes, app page and media URLs', () => {
    expect(renownStatsEndpoint('https://switchboard.renown-staging.vetra.io/graphql')).toBe(
      'https://switchboard.renown-staging.vetra.io/graphql/renown-stats',
    )
    expect(renownPackageRoutes('https://sb.example/graphql/')).toBe(
      'https://sb.example/api/@powerhousedao/renown-package',
    )
    expect(renownStatsEndpoint()).toBe('https://switchboard.renown.vetra.io/graphql/renown-stats')
    expect(appPageUrl(DID)).toBe(`https://www.renown.id/app/${DID}`)
    expect(renownMediaUrl('doc 9', 'cover')).toBe('https://www.renown.id/media/doc%209/cover')
  })

  it('versions media URLs from the attachment ref hash', () => {
    const ref = `attachment://v1:${'ab12'.repeat(16)}`
    expect(renownMediaUrl('doc-1', 'logo', ref)).toBe(
      'https://www.renown.id/media/doc-1/logo?v=ab12ab12ab12',
    )
    expect(renownMediaUrl('doc-1', 'logo', 'https://x.example/a.png')).toBe(
      'https://www.renown.id/media/doc-1/logo',
    )
    expect(renownMediaUrl('doc-1', 'logo', null)).toBe('https://www.renown.id/media/doc-1/logo')
  })
})

describe('fetchAppProfile', () => {
  it('reads a profile, null for none, and throws on a GraphQL error', async () => {
    const answer = (body: unknown) =>
      vi.fn(
        async (_url: string, _init: RequestInit) =>
          new Response(JSON.stringify(body), { status: 200 }),
      )
    const ok = answer({ data: { appProfile: PROFILE } })
    expect(await fetchAppProfile(DID, ok as unknown as typeof fetch)).toEqual(PROFILE)
    const sent = JSON.parse(ok.mock.calls[0]![1].body as string) as {
      query: string
      variables: unknown
    }
    expect(sent.variables).toEqual({ appDid: DID })
    expect(sent.query).toContain('appProfile(appDid: $appDid)')
    expect(
      await fetchAppProfile(DID, answer({ data: { appProfile: null } }) as unknown as typeof fetch),
    ).toBeNull()
    await expect(
      fetchAppProfile(DID, answer({ errors: [{ message: 'boom' }] }) as unknown as typeof fetch),
    ).rejects.toThrow('boom')
  })
})

describe('image crop math', () => {
  it('accepts PNG, JPEG and WebP sources up to 2 MB only', () => {
    expect(sourceImageProblem({ type: 'image/png', size: 2 * 1024 * 1024 })).toBeNull()
    expect(sourceImageProblem({ type: 'image/svg+xml', size: 10 })).toBe(
      'Choose a PNG, JPEG or WebP image.',
    )
    expect(sourceImageProblem({ type: 'image/webp', size: 2 * 1024 * 1024 + 1 })).toBe(
      'Choose an image of at most 2 MB.',
    )
  })

  it('selects the largest centred region of the aspect ratio, zoomed and panned', () => {
    expect(IMAGE_SPECS.logo).toMatchObject({
      aspect: 1,
      width: 512,
      height: 512,
      maxBytes: 1024 * 1024,
    })
    expect(IMAGE_SPECS.cover).toMatchObject({
      aspect: 3,
      width: 1500,
      height: 500,
      maxBytes: 2 * 1024 * 1024,
    })
    expect(cropRegion(1000, 1000, 3, INITIAL_CROP)).toEqual({ sx: 0, sy: 333, sw: 1000, sh: 333 })
    expect(cropRegion(3000, 1000, 3, INITIAL_CROP)).toEqual({ sx: 0, sy: 0, sw: 3000, sh: 1000 })
    expect(cropRegion(1000, 500, 1, INITIAL_CROP)).toEqual({ sx: 250, sy: 0, sw: 500, sh: 500 })
    expect(cropRegion(1000, 1000, 1, { zoom: 2, panX: 0, panY: 0 })).toEqual({
      sx: 250,
      sy: 250,
      sw: 500,
      sh: 500,
    })
    expect(cropRegion(1000, 1000, 1, { zoom: 2, panX: 1, panY: -1 })).toEqual({
      sx: 500,
      sy: 0,
      sw: 500,
      sh: 500,
    })
    // Out-of-range values are clamped.
    expect(cropRegion(1000, 1000, 1, { zoom: 9, panX: 5, panY: 0 })).toEqual({
      sx: 750,
      sy: 375,
      sw: 250,
      sh: 250,
    })
  })

  it('pans by screen pixels within the image', () => {
    const zoomed = { zoom: 2, panX: 0, panY: 0 }
    // 250 px viewport shows 500 source px: dragging 50 px left moves the crop 100 px right of 250 slack.
    expect(panBy(zoomed, 1000, 1000, 1, 250, -50, 0)).toEqual({ zoom: 2, panX: 0.4, panY: 0 })
    expect(panBy(zoomed, 1000, 1000, 1, 250, -5000, 5000)).toEqual({ zoom: 2, panX: 1, panY: -1 })
    // No slack (the whole width is selected): no horizontal pan.
    expect(panBy(INITIAL_CROP, 1000, 1000, 1, 250, -50, 0)).toEqual(INITIAL_CROP)
  })
})

describe('uploadRenownImage', () => {
  const blob = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
  const SHA = '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81'

  it('reserves with the purpose, then PUTs to the presigned target with its headers', async () => {
    const fetchImpl = vi.fn(async (url: string, _init: RequestInit) =>
      url.endsWith('/media/uploads')
        ? new Response(
            JSON.stringify({
              ref: `attachment://v1:${SHA}`,
              reservationId: 'r1',
              uploadTarget: {
                method: 'PUT',
                url: 'https://s3.example/put',
                headers: { 'content-type': 'image/webp' },
              },
            }),
            { status: 201 },
          )
        : new Response(null, { status: 200 }),
    )
    expect(
      await uploadRenownImage(blob(), 'logo', 'tok', fetchImpl as unknown as typeof fetch),
    ).toBe(`attachment://v1:${SHA}`)
    const [reserveUrl, reserve] = fetchImpl.mock.calls[0]!
    expect(reserveUrl).toBe(
      'https://switchboard.renown.vetra.io/api/@powerhousedao/renown-package/media/uploads',
    )
    expect(reserve.headers).toMatchObject({ authorization: 'Bearer tok' })
    expect(JSON.parse(reserve.body as string)).toEqual({
      purpose: 'logo',
      mimeType: 'image/webp',
      sizeBytes: 3,
      sha256: SHA,
    })
    const [putUrl, put] = fetchImpl.mock.calls[1]!
    expect(putUrl).toBe('https://s3.example/put')
    expect(put).toMatchObject({ method: 'PUT', headers: { 'content-type': 'image/webp' } })
  })

  it('skips the PUT for bytes Renown already has, and reports refusals with their code', async () => {
    const deduped = vi.fn(
      async () =>
        new Response(JSON.stringify({ ref: 'attachment://v1:x', deduped: true }), { status: 200 }),
    )
    expect(
      await uploadRenownImage(blob(), 'cover', 'tok', deduped as unknown as typeof fetch),
    ).toBe('attachment://v1:x')
    expect(deduped).toHaveBeenCalledTimes(1)
    const refused = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ code: 'TOO_LARGE', error: 'A logo may be at most 1048576 bytes' }),
          { status: 413 },
        ),
    )
    const error = await uploadRenownImage(
      blob(),
      'logo',
      'tok',
      refused as unknown as typeof fetch,
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ImageUploadError)
    expect(error).toMatchObject({
      code: 'TOO_LARGE',
      message: 'A logo may be at most 1048576 bytes',
    })
  })
})

describe('profile form', () => {
  const base: AppProfileForm = formFromProfile(PROFILE)

  it('starts from the stored profile, or empty', () => {
    expect(base).toMatchObject({
      name: 'Vault',
      category: 'Tools',
      logoRef: 'attachment://v1:aa',
      coverRef: null,
    })
    expect(formFromProfile(null)).toEqual({
      name: '',
      tagline: '',
      website: '',
      description: '',
      category: '',
      logoRef: null,
      coverRef: null,
      links: [],
      metrics: [],
    })
  })

  it('sends only what changed: trimmed text, "" to clear, the whole link list', () => {
    expect(changedFields(base, { ...base, tagline: '  Notes  ' })).toEqual({})
    expect(hasChanges(changedFields(base, base))).toBe(false)
    expect(
      changedFields(base, {
        ...base,
        name: ' Vault Pro ',
        category: '',
        logoRef: null,
        coverRef: 'attachment://v1:bb',
        links: [
          { id: 'l1', label: ' Docs ', url: 'https://docs.example' },
          { id: 'l2', label: 'Blog', url: 'https://blog.example' },
        ],
      }),
    ).toEqual({
      name: 'Vault Pro',
      category: '',
      logoRef: '',
      coverRef: 'attachment://v1:bb',
      links: [
        { id: 'l1', label: 'Docs', url: 'https://docs.example' },
        { id: 'l2', label: 'Blog', url: 'https://blog.example' },
      ],
    })
  })

  it('names every problem before anything is sent', () => {
    expect(formProblems(base)).toEqual({})
    expect(
      formProblems({
        ...base,
        name: 'n'.repeat(121),
        tagline: 't'.repeat(281),
        website: 'javascript:alert(1)',
        description: 'd'.repeat(2001),
        category: 'c'.repeat(41),
        links: [{ id: 'x', label: 'X', url: 'ftp://x.example' }],
      }),
    ).toEqual({
      name: 'At most 120 characters.',
      tagline: 'At most 280 characters.',
      website: 'Use an http(s) URL.',
      description: 'At most 2000 characters.',
      category: 'At most 40 characters.',
      links: 'Every link needs an http(s) URL.',
    })
    expect(
      formProblems({ ...base, links: [{ id: 'x', label: ' ', url: 'https://x.example' }] }).links,
    ).toBe('Every link needs a label of 1–40 characters.')
    const nine = Array.from({ length: 9 }, (_, i) => ({
      id: `${i}`,
      label: 'L',
      url: 'https://x.example',
    }))
    expect(formProblems({ ...base, links: nine }).links).toBe('At most 8 links.')
  })

  it('maps server fields onto form fields', () => {
    expect(fieldForServer('logoRef')).toBe('logo')
    expect(fieldForServer('coverRef')).toBe('cover')
    expect(fieldForServer('description')).toBe('description')
    expect(fieldForServer('appDid')).toBeNull()
    expect(fieldForServer(null)).toBeNull()
  })
})

describe('markdown-lite (copy of renown.id)', () => {
  it('keeps unsafe links as text', () => {
    expect(parseMarkdownLite('[a](https://a.example) [b](javascript:void0)')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'link', href: 'https://a.example/', children: [{ type: 'text', text: 'a' }] },
          { type: 'text', text: ' ' },
          { type: 'text', text: 'b' },
        ],
      },
    ])
  })
})

describe('renderImage encoder fallback', () => {
  it('retries as JPEG when the browser answers a WebP request with PNG', async () => {
    const asked: string[] = []
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => {}, imageSmoothingQuality: '' }),
      toBlob: (cb: (b: Blob | null) => void, type: string) => {
        asked.push(type)
        cb(new Blob(['x'], { type: type === 'image/jpeg' ? 'image/jpeg' : 'image/png' }))
      },
    }
    const spy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(canvas as unknown as HTMLElement)
    const image = { naturalWidth: 800, naturalHeight: 800 } as HTMLImageElement
    const blob = await renderImage(image, 'logo', INITIAL_CROP)
    spy.mockRestore()
    expect(blob.type).toBe('image/jpeg')
    expect(asked[0]).toBe('image/webp')
    expect(asked).toContain('image/jpeg')
  })
})
