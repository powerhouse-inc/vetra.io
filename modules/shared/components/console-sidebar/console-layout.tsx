import type { ReactNode } from 'react'
import { CommandPaletteProvider } from '@/modules/shared/components/command-palette/command-palette'
import { ActivityToasts } from './activity-toasts'
import { ConsoleSidebar } from './console-sidebar'

/** Shell for every signed-in console route: sidebar on the left, ⌘K and activity toasts everywhere. */
export function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <CommandPaletteProvider>
      <ActivityToasts />
      <div className="flex">
        <ConsoleSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </CommandPaletteProvider>
  )
}
