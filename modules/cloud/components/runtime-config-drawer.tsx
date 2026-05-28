'use client'

import { FileJson2, Loader2, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isDeepEqual } from 'remeda'
import { toast } from 'sonner'

import { AsyncButton } from '@/modules/cloud/components/async-button'
import { RuntimeConfigForm } from '@/modules/cloud/components/runtime-config-form'
import {
  RuntimeConfigJsonEditor,
  validateJsonString,
} from '@/modules/cloud/components/runtime-config-json-editor'
import { useRuntimeConfig } from '@/modules/cloud/hooks/use-runtime-config'
import type { PHConnectRuntimeConfig } from '@/modules/cloud/runtime-config/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/modules/shared/components/ui/alert-dialog'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/modules/shared/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/modules/shared/components/ui/tabs'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string | null
  /**
   * Human-readable env label rendered in the drawer header. Optional — falls
   * back to "Connect runtime configuration" when absent.
   */
  envLabel?: string | null
  /** Hide Save / Reset / Edit controls when the viewer cannot mutate the env. */
  readOnly?: boolean
  /** Initial tab to show. Defaults to 'form'. */
  initialTab?: 'form' | 'json'
}

/**
 * Side drawer for editing the deployed Connect's `powerhouse.config.json`.
 * Two synchronised views (Form + JSON) over the same in-memory editing
 * state. Save dispatches `setRuntimeConfig` against the vetra-cloud-runtime-config
 * subgraph; the rollout to the deployed file happens asynchronously via the
 * secrets-controller → ConfigMap → Reloader pipeline.
 */
export function RuntimeConfigDrawer({
  open,
  onOpenChange,
  tenantId,
  envLabel,
  readOnly,
  initialTab = 'form',
}: Props) {
  const { payload, isLoading, isSaving, error, setOverrides } = useRuntimeConfig(tenantId)

  const [draftOverrides, setDraftOverrides] = useState<PHConnectRuntimeConfig>(
    payload.overrides,
  )
  const [draftJson, setDraftJson] = useState<string>(
    JSON.stringify(payload.overrides, null, 2),
  )
  const [activeTab, setActiveTab] = useState<'form' | 'json'>(initialTab)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)

  // Track whether the JSON view's text is the authoritative draft (true
  // after the user types in JSON) or a derived render of `draftOverrides`
  // (true after the user types in Form). Used to prevent infinite ping-pong.
  const jsonIsAuthoritative = useRef(false)

  // Re-sync drafts when payload changes (initial load or after a successful
  // save). Compare by reference to avoid stomping in-progress edits.
  const lastPayloadOverridesRef = useRef(payload.overrides)
  useEffect(() => {
    if (lastPayloadOverridesRef.current !== payload.overrides) {
      lastPayloadOverridesRef.current = payload.overrides
      setDraftOverrides(payload.overrides)
      setDraftJson(JSON.stringify(payload.overrides, null, 2))
      jsonIsAuthoritative.current = false
    }
  }, [payload.overrides])

  // ----- editing handlers -----

  const handleFormChange = useCallback((next: PHConnectRuntimeConfig) => {
    setDraftOverrides(next)
    setDraftJson(JSON.stringify(next, null, 2))
    jsonIsAuthoritative.current = false
  }, [])

  const handleJsonChange = useCallback((next: string) => {
    setDraftJson(next)
    jsonIsAuthoritative.current = true
    const result = validateJsonString(next)
    if (result.ok && result.parsed && typeof result.parsed === 'object') {
      setDraftOverrides(result.parsed as PHConnectRuntimeConfig)
    }
  }, [])

  const handleTabChange = useCallback(
    (next: string) => {
      if (next === 'form' && jsonIsAuthoritative.current) {
        const result = validateJsonString(draftJson)
        if (!result.ok) {
          toast.error('Fix JSON errors before switching to the form view')
          return
        }
      }
      setActiveTab(next as 'form' | 'json')
    },
    [draftJson],
  )

  const hasUnsavedChanges = useMemo(
    () => !isDeepEqual(draftOverrides, payload.overrides),
    [draftOverrides, payload.overrides],
  )

  const jsonValid = useMemo(() => validateJsonString(draftJson).ok, [draftJson])
  const canSave = hasUnsavedChanges && jsonValid && !isSaving && !readOnly
  const canReset = !isSaving && !readOnly && Object.keys(draftOverrides).length > 0

  // ----- actions -----

  const doSave = useCallback(async () => {
    try {
      await setOverrides(draftOverrides)
      toast.success('Runtime config saved — Connect will restart shortly')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }, [draftOverrides, setOverrides])

  const doReset = useCallback(() => {
    setDraftOverrides({})
    setDraftJson(JSON.stringify({}, null, 2))
    jsonIsAuthoritative.current = false
  }, [])

  const doDiscard = useCallback(() => {
    setDraftOverrides(payload.overrides)
    setDraftJson(JSON.stringify(payload.overrides, null, 2))
    jsonIsAuthoritative.current = false
    setConfirmDiscardOpen(false)
  }, [payload.overrides])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && hasUnsavedChanges) {
        setConfirmDiscardOpen(true)
        return
      }
      onOpenChange(next)
    },
    [hasUnsavedChanges, onOpenChange],
  )

  // ----- render -----

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="top-16 flex h-[calc(100vh-4rem)] w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="flex min-w-0 flex-col gap-1.5">
              <SheetTitle className="flex items-center gap-2">
                <FileJson2 className="h-4 w-4" />
                Runtime config
                {envLabel && (
                  <span className="text-muted-foreground truncate text-sm font-normal">
                    · {envLabel}
                  </span>
                )}
              </SheetTitle>
              <SheetDescription>
                Edit the Connect SPA&rsquo;s{' '}
                <code className="font-mono text-xs">powerhouse.config.json</code>.
              </SheetDescription>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-2">
                {hasUnsavedChanges && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDiscardOpen(true)}
                    disabled={isSaving}
                  >
                    Discard
                  </Button>
                )}
                <AsyncButton
                  size="sm"
                  pendingLabel="Saving…"
                  disabled={!canSave}
                  onClickAsync={doSave}
                  className="gap-1.5"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save
                </AsyncButton>
              </div>
            )}
          </div>
        </SheetHeader>

        {error && (
          <div className="text-destructive border-destructive/30 bg-destructive/10 border-b px-6 py-2 text-xs">
            {error.message}
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 px-6 pt-4">
            <TabsList>
              <TabsTrigger value="form">Form</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={doReset}
                disabled={!canReset}
                className="text-muted-foreground gap-1.5"
                title="Clear all overrides — every field falls back to defaults"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to defaults
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="form" className="mt-0">
              {isLoading ? (
                <LoadingPlaceholder />
              ) : (
                <RuntimeConfigForm
                  overrides={draftOverrides}
                  onChange={handleFormChange}
                  disabled={readOnly || isSaving}
                />
              )}
            </TabsContent>
            <TabsContent value="json" className="mt-0 h-full min-h-[420px]">
              <RuntimeConfigJsonEditor
                value={draftJson}
                onChange={handleJsonChange}
                readOnly={readOnly || isSaving}
              />
            </TabsContent>
          </div>
        </Tabs>

        <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard changes?</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Discarding will revert all edits since the last save.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  doDiscard()
                  onOpenChange(false)
                }}
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}

function LoadingPlaceholder() {
  return (
    <div className="text-muted-foreground flex h-32 items-center justify-center gap-2 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading runtime config…
    </div>
  )
}
