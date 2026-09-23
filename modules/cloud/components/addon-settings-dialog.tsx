'use client'

import { ConfigRow } from '@/modules/cloud/components/config-row'
import type { AddonConfigStore, AddonDefinition } from '@/modules/cloud/lib/addons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/components/ui/table'

type Props = {
  addon: AddonDefinition
  store: AddonConfigStore
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddonSettingsDialog({ addon, store, open, onOpenChange }: Props) {
  const varValues = new Map(store.envVars.map((v) => [v.key, v.value]))
  const secretKeys = new Set(store.secrets.map((s) => s.key))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{addon.label} settings</DialogTitle>
          <DialogDescription>Saving a change restarts the reactor.</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setting</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-16 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {addon.config.map((field) =>
              field.type === 'secret' ? (
                <ConfigRow
                  key={field.name}
                  entry={field}
                  currentValue={null}
                  isSet={secretKeys.has(field.name)}
                  onSave={(value) => store.setSecret(field.name, value)}
                  onDelete={() => store.deleteSecret(field.name)}
                />
              ) : (
                <ConfigRow
                  key={field.name}
                  entry={field}
                  currentValue={varValues.get(field.name) ?? null}
                  isSet={varValues.has(field.name)}
                  onSave={(value) => store.setVar(field.name, value)}
                  onDelete={() => store.deleteVar(field.name)}
                />
              ),
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}
