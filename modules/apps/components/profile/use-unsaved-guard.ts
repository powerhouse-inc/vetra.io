import { useEffect } from 'react'

const MESSAGE = 'You have unsaved profile changes. Leave without saving?'

/**
 * Warns before unsaved edits are lost: closing/reloading the page, following an in-app link,
 * or clicking another tab of the app page.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
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
      if (!window.confirm(MESSAGE)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onTabMouseDown = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return
      const tab = e.target.closest('[role="tab"]')
      if (!tab || tab.getAttribute('aria-selected') === 'true') return
      if (!window.confirm(MESSAGE)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    document.addEventListener('mousedown', onTabMouseDown, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('mousedown', onTabMouseDown, true)
    }
  }, [dirty])
}
