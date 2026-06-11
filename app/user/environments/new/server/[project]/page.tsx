'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Package } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, use } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { RequireSigner } from '@/modules/cloud/components/require-signer'
import { useEnvironmentDetail } from '@/modules/cloud/hooks/use-environment-detail'
import {
  StripedCard,
  StripedCardContent,
  StripedCardHeader,
  StripedCardTitle,
} from '@/modules/shared/components/striped-card'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/modules/shared/components/ui/breadcrumb'

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

type PageProps = {
  params: Promise<{
    project: string
  }>
}

const schema = z.object({
  packageName: z.string().min(1, 'Package name is required'),
  version: z.string().optional(),
})

export type AddPackageFormValues = z.infer<typeof schema>

export default function AddPackagePage({ params }: PageProps) {
  const { project } = use(params)
  const { environment, isLoading, addPackage } = useEnvironmentDetail(project)
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AddPackageFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      packageName: '',
      version: '',
    },
  })

  const handleSubmit = async (values: AddPackageFormValues) => {
    try {
      setIsSubmitting(true)
      await addPackage(values.packageName, values.version || undefined)
      toast.success('Package added successfully')
      router.push(`/user/environments/${project}`)
    } catch (error) {
      console.error('Failed to add package:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add package')
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayName = environment?.state.label || environment?.name || 'Loading...'

  if (isLoading) {
    return (
      <main className="container mx-auto mt-[80px] max-w-screen-xl p-8">
        <p className="text-muted-foreground">Loading environment...</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto mt-[80px] max-w-screen-xl space-y-8 p-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Add Package</h1>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/user/environments">Cloud</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/user/environments/${project}`}>{displayName}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Add Package</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="mx-auto max-w-xl">
        <StripedCard>
          <StripedCardHeader>
            <StripedCardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              New Package
            </StripedCardTitle>
          </StripedCardHeader>
          <StripedCardContent className="p-4">
            <RequireSigner>
              <Form {...form}>
                <form onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="packageName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Package Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. @powerhouse/my-package" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="version"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Version (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 1.0.0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="mt-6 flex gap-2">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Adding...' : 'Add Package'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push(`/user/environments/${project}`)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </RequireSigner>
          </StripedCardContent>
        </StripedCard>
      </div>
    </main>
  )
}
