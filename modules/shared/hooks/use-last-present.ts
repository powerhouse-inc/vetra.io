import { useState } from 'react'

/**
 * The value while it is present, and the last present one after it goes away. A dialog driven by
 * `value !== null` closes with an exit animation; reading its copy from here keeps the title and
 * body steady until it is gone, instead of blanking or flipping mid-fade.
 */
export function useLastPresent<T>(value: T | null | undefined): T | null {
  const [last, setLast] = useState<T | null>(value ?? null)
  if (value != null && value !== last) setLast(value)
  return value ?? last
}
