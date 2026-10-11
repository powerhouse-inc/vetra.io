import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '../avatar'

/** Pretends the browser already settled the <img> before React attached its handlers (SSR). */
function stubImage({ complete, naturalWidth }: { complete: boolean; naturalWidth: number }) {
  const proto = HTMLImageElement.prototype
  const restore = [
    vi.spyOn(proto, 'complete', 'get').mockReturnValue(complete),
    vi.spyOn(proto, 'naturalWidth', 'get').mockReturnValue(naturalWidth),
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
