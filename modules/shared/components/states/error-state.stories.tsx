import { ErrorState } from './error-state'
import type { Meta, StoryObj } from '@storybook/nextjs'

const meta = {
  title: 'Shared/States/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ErrorState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Could not load your apps',
    message: 'The server did not respond. Check your connection and try again.',
  },
}

export const WithRetry: Story = {
  args: {
    title: 'Could not load your apps',
    message: 'The server did not respond. Check your connection and try again.',
    onRetry: () => {},
  },
}

export const Retrying: Story = {
  args: { ...WithRetry.args, title: 'Could not load your apps', retrying: true },
}

export const WithRequestId: Story = {
  args: {
    ...WithRetry.args,
    title: 'Could not load your apps',
    requestId: 'req_01HZX4V9K2M3',
  },
}
