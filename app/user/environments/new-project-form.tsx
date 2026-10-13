'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { DRIVE_ID } from '@/modules/cloud/client'
import { loadEnvironmentController } from '@/modules/cloud/controller'
import {
  EnvironmentHandOverError,
  describeEnvironmentOrgError,
  ensureCanOperateEnvironment,
} from '@/modules/cloud/org-sync'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { useCreateEnvironment } from '@/modules/cloud/hooks/use-create-environment'
import { RequireSigner } from '@/modules/cloud/components/require-signer'
import { generateSubdomain } from '@/modules/cloud/subdomain'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/modules/shared/components/ui/form'
import { Input } from '@/modules/shared/components/ui/input'
import { defaultPackageRegistry } from '@/modules/cloud/switchboard-url'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
})

export type EnvironmentFormValues = z.infer<typeof schema>

type NewEnvironmentFormProps = {
  docId?: string
  initialName?: string
  onCreated?: (id: string) => void
  onSuccess?: () => void
}

export function NewEnvironmentForm(props: NewEnvironmentFormProps) {
  return (
    <RequireSigner>
      <NewEnvironmentFormInner {...props} />
    </RequireSigner>
  )
}

function NewEnvironmentFormInner({
  docId,
  initialName,
  onCreated,
  onSuccess,
}: NewEnvironmentFormProps) {
  const { signer } = useCanSign()
  const { orgId, org } = useActiveOrg()
  const createEnv = useCreateEnvironment()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<EnvironmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialName ?? '',
    },
  })

  const isRenameMode = !!docId
  // Creating in an organisation needs PUBLISHER or above there (setEnvironmentOrg).
  const orgRefusal =
    !isRenameMode && org?.role === 'MEMBER'
      ? `Members of ${org.name} cannot create environments. Ask an organisation admin for publisher access, or switch to your personal account.`
      : null

  const handleSubmit = async (values: EnvironmentFormValues) => {
    try {
      setIsSubmitting(true)
      setError(null)
      setSuccess(false)

      if (docId) {
        // Rename existing environment via signed action
        if (!signer) {
          throw new Error('You must be logged in with Renown to rename an environment')
        }
        const ctrl = await loadEnvironmentController({
          documentId: docId,
          parentIdentifier: DRIVE_ID,
          signer,
        })
        await ensureCanOperateEnvironment(docId, ctrl, signer.user?.address)
        ctrl.setLabel({ label: values.name })
        await ctrl.push()
      } else {
        // Create new environment in a single signed batch
        const subdomain = generateSubdomain(crypto.randomUUID())
        const { documentId } = await createEnv({
          label: values.name,
          subdomain,
          baseDomain: 'vetra.io',
          defaultPackageRegistry: defaultPackageRegistry(),
          enabledServices: [{ type: 'CONNECT', prefix: 'connect' }],
          orgId,
        })
        onCreated?.(documentId)
      }

      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      if (err instanceof EnvironmentHandOverError) {
        // The env exists (personal); only the move to the organisation failed.
        onCreated?.(err.environmentId)
        setError(
          `Created as a personal environment; moving it to ${org?.name ?? 'the organisation'} failed: ${describeEnvironmentOrgError(err.message, org?.name)}`,
        )
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save environment')
      }
      console.error('Failed to save environment:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter environment name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {error && <div className="text-destructive mt-2 text-sm">{error}</div>}
        {success && (
          <div className="mt-2 text-sm text-green-600">
            Environment {isRenameMode ? 'updated' : 'created'} successfully!
          </div>
        )}
        {!isRenameMode && org && !orgRefusal && (
          <p className="text-muted-foreground mt-2 text-sm">It will belong to {org.name}.</p>
        )}
        {orgRefusal && <p className="text-muted-foreground mt-2 text-sm">{orgRefusal}</p>}
        <div className="mt-4">
          <Button type="submit" disabled={isSubmitting || !!orgRefusal} size="sm">
            {isSubmitting ? 'Saving...' : isRenameMode ? 'Update Name' : 'Create Environment'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
