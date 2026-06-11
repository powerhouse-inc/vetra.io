export type { CloudEnvironment } from '@/modules/cloud/types'

export type OptionValue = [value: string, label: string]

export type CloudEnvironmentFormValues = {
  address: string
  packages: OptionValue[]
  resources: OptionValue[]
  label: OptionValue[]
  admin: OptionValue[]
  backup: boolean
}
