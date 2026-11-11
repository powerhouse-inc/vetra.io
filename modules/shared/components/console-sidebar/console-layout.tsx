import type { ReactNode } from 'react'
import { ActivityToasts } from './activity-toasts'
import { ConsoleSidebar } from './console-sidebar'

/**
 * Shell for every signed-in console route: sidebar on the left, activity toasts everywhere
 * (search and ⌘K live in the top bar's ConsoleSearch). */
export function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ActivityToasts />
      <div className="flex">
        <ConsoleSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  )
}
