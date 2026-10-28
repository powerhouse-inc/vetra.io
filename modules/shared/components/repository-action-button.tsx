'use client'

import { Check, ChevronDown, Copy } from 'lucide-react'
import { useState } from 'react'

import VetraLogo from '@/modules/shared/components/svgs/vetra-logo.svg'
import { Button } from '@/modules/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/modules/shared/components/ui/popover'

interface RepositoryActionButtonProps {
  githubUrl?: string | null
  driveId?: string | null
  packageName?: string | null
}

export function RepositoryActionButton({
  githubUrl,
  driveId,
  packageName,
}: RepositoryActionButtonProps) {
  const [open, setOpen] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const hasGithubUrl = !!githubUrl

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCommand(text)
      setTimeout(() => setCopiedCommand(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Generate the drive URL
  const driveUrl = driveId
    ? `https://switchboard.vetra.io/d/${driveId}`
    : 'https://switchboard.vetra.io/d/61fff014-ff45-4270-aa16-5ca75429cc55'

  // Convert package name to kebab-case
  const kebabCaseName = packageName
    ? packageName
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
    : '<package-name>'

  // Generate the ph init command with package name
  const phInitCommand = `ph init ${kebabCaseName} --remote-drive ${driveUrl}`

  // Generate the ph checkout command with remote drive
  const phCheckoutCommand = `ph checkout --remote-drive ${driveUrl}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="flex p-1 py-5">
          <div className="flex items-center gap-2">
            <div className="bg-muted flex h-8 w-8 items-center justify-center rounded p-1.5">
              <VetraLogo className="h-full w-full" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium tracking-wide uppercase">
                {hasGithubUrl ? 'Explore repository' : 'Create repository'}
              </span>
              <span className="text-sm font-bold">with Powerhouse</span>
            </div>
            <ChevronDown className="ml-1 h-4 w-4" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <div className="bg-card rounded-lg p-4">
          {hasGithubUrl ? (
            // Explore Repository Content
            <div className="space-y-4">
              {/* Ph Checkout Command */}
              <div className="bg-muted/50 space-y-2 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <code className="flex-1 font-mono text-sm break-all">{phCheckoutCommand}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => void copyToClipboard(phCheckoutCommand)}
                  >
                    {copiedCommand === phCheckoutCommand ? (
                      <Check className="text-success h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">Checkout with Vetra</p>
              </div>
            </div>
          ) : (
            // Create Repository Content
            <div className="bg-muted/50 space-y-2 rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <code className="flex-1 font-mono text-sm break-all">{phInitCommand}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => void copyToClipboard(phInitCommand)}
                >
                  {copiedCommand === phInitCommand ? (
                    <Check className="text-success h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Initialize a repository & connect to the Vetra Drive
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
