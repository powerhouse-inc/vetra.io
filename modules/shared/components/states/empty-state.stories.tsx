import { Package, Plus } from 'lucide-react'
import React from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import { EmptyState } from './empty-state'
import type { Meta, StoryObj } from '@storybook/nextjs'

const meta = {
  title: 'Shared/States/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    icon: Package,
    title: 'No packages yet',
    description: 'Publish a package to list it here.',
  },
}

export const WithAction: Story = {
  args: {
    icon: Package,
    title: 'No packages yet',
    description: 'Publish a package to list it here.',
    action: (
      <Button size="sm" variant="outline" className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Publish package
      </Button>
    ),
    cliHint: 'ph publish',
  },
}

export const TitleOnly: Story = {
  args: { title: 'Nothing here' },
}
