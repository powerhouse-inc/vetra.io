'use client'

import { useUser } from '@powerhousedao/reactor-browser'
import { Check, Cloud, ChevronDown, LogIn, Plus } from 'lucide-react'
import Link from 'next/link'
import { useEnvironments } from '@/modules/cloud/hooks/use-environment'
import { Button } from '@/modules/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/modules/shared/components/ui/dropdown-menu'

interface AddToCloudProps {
  packageName: string
  version?: string
}

export function AddToCloud({ packageName, version }: AddToCloudProps) {
  const user = useUser()
  const isAuthenticated = !!user
  const environments = useEnvironments()

  const addParams = new URLSearchParams({
    tab: 'overview',
    addPackage: packageName,
  })
  if (version) addParams.set('version', version)

  if (!isAuthenticated) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Sign in to add this package to your Cloud environment.
        </p>
        <Button size="sm" variant="outline" asChild className="w-full">
          <Link href="/cloud">
            <LogIn className="size-4" />
            Sign in
          </Link>
        </Button>
      </div>
    )
  }

  if (environments.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Deploy this package to a Vetra Cloud environment.
        </p>
        <Button size="sm" asChild className="w-full">
          <Link href="/user/environments/new">
            <Plus className="size-4" />
            Create Environment
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">Add this package to one of your environments.</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="w-full justify-between">
            Add to Environment
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {environments.map((env) => {
            const installed = env.state.packages.some((p) => p.name === packageName)
            return (
              <DropdownMenuItem key={env.id} asChild disabled={installed}>
                {installed ? (
                  <div className="flex items-center gap-2 opacity-60">
                    <Check className="text-primary size-4" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {env.state.label || env.state.genericSubdomain || 'Unnamed'}
                      </p>
                      <p className="text-primary text-[10px]">Already installed</p>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/user/environments/${env.id}?${addParams.toString()}`}
                    className="flex items-center gap-2"
                  >
                    <Cloud className="text-muted-foreground size-4" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {env.state.label || env.state.genericSubdomain || 'Unnamed'}
                      </p>
                      <p className="text-muted-foreground text-[10px]">
                        {env.state.packages.length} package
                        {env.state.packages.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </Link>
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
