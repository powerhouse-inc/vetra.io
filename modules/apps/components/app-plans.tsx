'use client'

import { Layers } from 'lucide-react'

import {
  EmptyState,
  TabError,
  TabHeader,
  TabSkeleton,
} from '@/modules/publisher/components/primitives'

import { describeAppsError } from '../graphql'
import { useAppPlans } from '../hooks/use-apps'
import { TermInstances } from './term-instances'

/**
 * Plans tab for someone who changes plans without publishing the app's licensing (a release
 * manager): the plans Vetra runs instances for, each with its target, size and actions. New
 * plans are adopted from licensing terms by the publisher.
 */
export function AppPlans({ appId, canRelease = true }: { appId: string; canRelease?: boolean }) {
  const plans = useAppPlans(appId)
  const list = [...(plans.data ?? [])].sort((a, b) =>
    a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'active' ? -1 : 1,
  )
  return (
    <div className="space-y-6">
      <TabHeader
        title="Plans"
        description="The plans Vetra runs instances for: which release they run and on what size. The app's publisher adds plans from its licensing plans."
      />
      {plans.isPending ? (
        <TabSkeleton label="Loading plans" />
      ) : plans.error ? (
        <TabError
          error={new Error(describeAppsError(plans.error))}
          onRetry={() => void plans.refetch()}
          retrying={plans.isRefetching}
        />
      ) : list.length === 0 ? (
        <EmptyState icon={Layers} title="No plans run instances yet">
          When the app&apos;s publisher runs instances for a licensing plan, it shows up here.
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {list.map((p) => (
            <li key={p.id} className="bg-card border-border space-y-3 rounded-xl border p-4">
              <h3 className="font-semibold">{p.name}</h3>
              <TermInstances
                appId={appId}
                term={{ kind: p.kind, name: p.name, activeLicenses: 0 }}
                canRelease={canRelease}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
