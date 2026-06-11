'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { DRIVE_ID } from '@/modules/cloud/client'
import { loadEnvironmentController } from '@/modules/cloud/controller'
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
        ctrl.setLabel({ label: values.name })
        await ctrl.push()
      } else {
        // Create new environment in a single signed batch
        const subdomain = generateSubdomain(crypto.randomUUID())
        const { documentId } = await createEnv({
          label: values.name,
          subdomain,
          baseDomain: 'vetra.io',
          defaultPackageRegistry: 'https://registry.dev.vetra.io',
          enabledServices: [{ type: 'CONNECT', prefix: 'connect' }],
        })
        onCreated?.(documentId)
      }

      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save environment')
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
        <div className="mt-4">
          <Button type="submit" disabled={isSubmitting} size="sm">
            {isSubmitting ? 'Saving...' : isRenameMode ? 'Update Name' : 'Create Environment'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
