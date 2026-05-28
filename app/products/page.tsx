'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'

type EnvStatus = 'ready' | 'deploying' | 'draft'

interface Environment {
  name: string
  status: EnvStatus
  pkgs: number
}

interface Product {
  id: string
  name: string
  initials: string
  color: string
  environments: Environment[]
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'np',
    name: 'Neighborhood Platform',
    initials: 'NP',
    color: 'bg-emerald-600',
    environments: [
      { name: 'Production', status: 'ready', pkgs: 4 },
      { name: 'Staging', status: 'ready', pkgs: 4 },
      { name: 'Dev', status: 'draft', pkgs: 2 },
    ],
  },
  {
    id: 'rp',
    name: 'Rental Platform',
    initials: 'RP',
    color: 'bg-violet-600',
    environments: [
      { name: 'Production', status: 'ready', pkgs: 6 },
      { name: 'Canary', status: 'deploying', pkgs: 6 },
    ],
  },
]

const UNGROUPED_COUNT = 1

const statusDot: Record<EnvStatus, string> = {
  ready: 'bg-emerald-400',
  deploying: 'bg-amber-400',
  draft: 'bg-muted-foreground/50',
}

function envSummary(envs: Environment[]) {
  const ready = envs.filter((e) => e.status === 'ready').length
  const deploying = envs.filter((e) => e.status === 'deploying').length
  const draft = envs.filter((e) => e.status === 'draft').length
  const parts = [`${envs.length} environment${envs.length !== 1 ? 's' : ''}`]
  if (ready) parts.push(`${ready} Ready`)
  if (deploying) parts.push(`${deploying} Deploying`)
  if (draft) parts.push(`${draft} Draft`)
  return parts.join(' · ')
}

export default function ProductsPage() {
  return (
    <div className="bg-background min-h-screen px-6 pt-28 pb-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-foreground text-2xl font-bold">Environments</h1>
          <div className="flex items-center gap-3">
            <button className="border-border bg-accent text-foreground hover:bg-accent/70 rounded-lg border px-4 py-2 text-sm font-medium transition-colors">
              View: Mine
            </button>
            <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold transition-colors">
              + New Environment
            </button>
          </div>
        </div>

        {/* Product groups */}
        <div className="space-y-4">
          {MOCK_PRODUCTS.map((product) => (
            <div key={product.id} className="bg-card border-border rounded-xl border p-5">
              {/* Product header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white ${product.color}`}
                  >
                    {product.initials}
                  </div>
                  <div>
                    <p className="text-foreground font-semibold">{product.name}</p>
                    <p className="text-muted-foreground text-xs">{envSummary(product.environments)}</p>
                  </div>
                </div>
                <button className="border-border bg-background text-foreground hover:bg-accent rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors">
                  + Add environment
                </button>
              </div>

              {/* Environment cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {product.environments.map((env) => (
                  <div key={env.name} className="bg-background border-border rounded-lg border px-4 py-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${statusDot[env.status]}`} />
                      <span className="text-foreground text-sm font-semibold">{env.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">📦 {env.pkgs} pkgs</span>
                      <Link
                        href="/cloud"
                        className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-400"
                      >
                        Manage →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Ungrouped */}
          <div className="border-border rounded-xl border border-dashed p-5">
            <div className="flex items-center gap-3">
              <div className="border-border bg-accent flex h-10 w-10 items-center justify-center rounded-lg border">
                <Plus className="text-muted-foreground h-4 w-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Ungrouped ({UNGROUPED_COUNT})
                </p>
                <p className="text-muted-foreground/60 text-xs">
                  Environments not assigned to a product
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
