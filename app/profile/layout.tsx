import type { ReactNode } from 'react'
import { ConsoleLayout } from '@/modules/shared/components/console-sidebar/console-layout'

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <ConsoleLayout>{children}</ConsoleLayout>
}
