import { useEffect } from 'react'

const MESSAGE = 'You have unsaved profile changes. Leave without saving?'
const TAB_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

function otherTab(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const tab = target.closest('[role="tab"]')
  return !!tab && tab.getAttribute('aria-selected') !== 'true'
}

/**
 * Warns before unsaved edits are lost: closing/reloading the page, following an in-app link,
 * or switching to another tab of the app page (mouse or keyboard).
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const veto = (e: Event) => {
      if (!window.confirm(MESSAGE)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return
      const anchor = e.target.closest('a[href]')
      if (!anchor || anchor.getAttribute('target') === '_blank' || anchor.hasAttribute('download'))
        return
      const href = anchor.getAttribute('href') ?? ''
      if (href.startsWith('#') || href.startsWith('mailto:')) return
      veto(e)
    }
    const onMouseDown = (e: MouseEvent) => {
      if (otherTab(e.target)) veto(e)
    }
    // Arrow keys on a tab list move focus and activate the neighbouring tab.
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('[role="tablist"]')) return
      if (TAB_KEYS.has(e.key) || ((e.key === 'Enter' || e.key === ' ') && otherTab(e.target)))
        veto(e)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [dirty])
}
