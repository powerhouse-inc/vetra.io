import RootLayout from '@/app/layout'
import { consoleFontVars } from '@/modules/landing/fonts'
import type { StoryContext } from '@storybook/nextjs'

/**
 * Storybook decorator to apply the root layout to the page stories
 */
export const withNextjsExtras = (Story: React.ComponentType, context: StoryContext) => {
  if (context.parameters.includeLayout) {
    return (
      <RootLayout>
        <Story />
      </RootLayout>
    )
  }

  return (
    <div className={`dark ${consoleFontVars} bg-background text-foreground font-sans antialiased`}>
      <Story />
    </div>
  )
}
