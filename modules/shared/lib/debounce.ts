/** Trailing-edge debouncer: coalesces a burst of calls into one fire after `ms`. */
export function createDebouncer<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    call(...args: T) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        fn(...args)
      }, ms)
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = undefined
    },
  }
}
