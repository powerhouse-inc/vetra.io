import type { ReactNode } from 'react'

/** Puts the footer on the dark console ground, the same as the navbar. */
export function FooterScope({ children }: { children: ReactNode }) {
  return <div className="[&_footer]:border-console-line [&_footer]:bg-console-bg">{children}</div>
}
