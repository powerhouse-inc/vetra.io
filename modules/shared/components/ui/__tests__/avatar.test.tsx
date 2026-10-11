import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '../avatar'

/** Pretends the browser already settled the <img> before React attached its handlers (SSR). */
function stubImage({
  complete,
  naturalWidth,
  naturalHeight = naturalWidth,
}: {
  complete: boolean
  naturalWidth: number
  naturalHeight?: number
}) {
  const proto = HTMLImageElement.prototype
  const restore = [
    vi.spyOn(proto, 'complete', 'get').mockReturnValue(complete),
    vi.spyOn(proto, 'naturalWidth', 'get').mockReturnValue(naturalWidth),
    vi.spyOn(proto, 'naturalHeight', 'get').mockReturnValue(naturalHeight),
  ]
  return () => restore.forEach((spy) => spy.mockRestore())
}

function renderAvatar(src: string | undefined) {
  return render(
    <Avatar>
      <AvatarImage src={src} alt="Me" />
      <AvatarFallback>FB</AvatarFallback>
    </Avatar>,
  )
}

describe('AvatarImage', () => {
  let restore: (() => void) | undefined
  afterEach(() => {
    restore?.()
    restore = undefined
    cleanup()
  })

  it('shows the image when it loaded', () => {
    restore = stubImage({ complete: true, naturalWidth: 64 })
    const { getByRole } = renderAvatar('https://x/ok.png')
    expect(getByRole('img', { name: 'Me' }).style.display).not.toBe('none')
  })

  it('hides an image that already failed before hydration (complete, naturalWidth 0)', () => {
    restore = stubImage({ complete: true, naturalWidth: 0 })
    const { container, getByText } = renderAvatar('https://x/broken.png')
    expect(container.querySelector('img')).toBeNull()
    expect(getByText('FB')).toBeTruthy()
  })

  it('keeps a loaded image that reports no width but a height (some SVGs)', () => {
    restore = stubImage({ complete: true, naturalWidth: 0, naturalHeight: 24 })
    const { getByRole } = renderAvatar('https://x/icon.svg')
    expect(getByRole('img', { name: 'Me' })).toBeTruthy()
  })

  it("passes the caller's ref through and still recovers a pre-hydration failure", () => {
    restore = stubImage({ complete: true, naturalWidth: 0 })
    const callerRef = React.createRef<HTMLImageElement>()
    const { container } = render(
      <Avatar>
        <AvatarImage ref={callerRef} src="https://x/broken.png" alt="Me" />
        <AvatarFallback>FB</AvatarFallback>
      </Avatar>,
    )
    expect(container.querySelector('img')).toBeNull()
    restore()
    restore = stubImage({ complete: false, naturalWidth: 0 })
    const ok = render(
      <Avatar>
        <AvatarImage ref={callerRef} src="https://x/ok.png" alt="Me2" />
      </Avatar>,
    )
    expect(callerRef.current).toBe(ok.getByRole('img', { name: 'Me2' }))
  })

  it('leaves a still-loading image alone', () => {
    restore = stubImage({ complete: false, naturalWidth: 0 })
    const { getByRole } = renderAvatar('https://x/slow.png')
    expect(getByRole('img', { name: 'Me' })).toBeTruthy()
  })

  it('hides the image on a later error and shows it again for a new src', () => {
    restore = stubImage({ complete: false, naturalWidth: 0 })
    const onError = vi.fn()
    const { container, rerender } = render(
      <Avatar>
        <AvatarImage src="https://x/a.png" alt="Me" onError={onError} />
        <AvatarFallback>FB</AvatarFallback>
      </Avatar>,
    )
    act(() => {
      fireEvent.error(container.querySelector('img')!)
    })
    expect(container.querySelector('img')).toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)

    rerender(
      <Avatar>
        <AvatarImage src="https://x/b.png" alt="Me" onError={onError} />
        <AvatarFallback>FB</AvatarFallback>
      </Avatar>,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/b.png')
  })

  it('renders no <img> without a src', () => {
    const { container } = renderAvatar(undefined)
    expect(container.querySelector('img')).toBeNull()
  })
})
