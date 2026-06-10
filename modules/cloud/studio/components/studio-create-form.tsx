'use client'

import { useState } from 'react'
import { AsyncButton } from '@/modules/cloud/components/async-button'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'

export function StudioCreateForm({
  onCreate,
  error,
}: {
  onCreate: (apiKey: string) => Promise<void>
  error: string | null
}) {
  const [apiKey, setApiKey] = useState('')
  return (
    <div className="mx-auto mt-16 max-w-md space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Set up your Vetra Studio</h1>
        <p className="text-muted-foreground text-sm">
          Studio runs as a dedicated agent in your cloud. Provide an Anthropic API key to start it.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="anthropic-key">Anthropic API key</Label>
        <Input
          id="anthropic-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <AsyncButton
        onClickAsync={async () => {
          if (!apiKey.trim()) throw new Error('An Anthropic API key is required')
          await onCreate(apiKey.trim())
        }}
        disabled={!apiKey.trim()}
        pendingLabel="Creating studio…"
      >
        Create studio
      </AsyncButton>
    </div>
  )
}
