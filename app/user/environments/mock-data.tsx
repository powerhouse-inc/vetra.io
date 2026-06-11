import type { OptionValue } from './types'

const CLOUD_ENVIRONMENTS_PACKAGES: OptionValue[] = [
  ['nginx', 'Nginx'],
  ['apache', 'Apache'],
  ['mysql', 'MySQL'],
  ['postgresql', 'PostgreSQL'],
  ['mongodb', 'MongoDB'],
  ['redis', 'Redis'],
]

const CLOUD_ENVIRONMENTS_RESOURCES: OptionValue[] = [
  ['micro', 'Micro (512MB, 1vCPU)'],
  ['small', 'Small (1GB, 1vCPU)'],
  ['medium', 'Medium (2GB, 2vCPU)'],
  ['large', 'Large (4GB, 4vCPU)'],
  ['x-large', 'X-Large (8GB, 8vCPU)'],
  ['2x-large', '2X-Large (16GB, 16vCPU)'],
  ['4x-large', '4X-Large (32GB, 32vCPU)'],
  ['8x-large', '8X-Large (64GB, 64vCPU)'],
  ['16x-large', '16X-Large (128GB, 128vCPU)'],
  ['32x-large', '32X-Large (256GB, 256vCPU)'],
  ['64x-large', '64X-Large (512GB, 512vCPU)'],
  ['128x-large', '128X-Large (1024GB, 1024vCPU)'],
]

const CLOUD_ENVIRONMENTS_LABELS: OptionValue[] = [
  ['default', 'Default'],
  ['production', 'Production'],
  ['staging', 'Staging'],
  ['development', 'Development'],
]

const CLOUD_ENVIRONMENTS_ADMINS: OptionValue[] = [
  ['admin', 'Admin'],
  ['user', 'User'],
  ['root', 'Root'],
]

export function getEnvironmentFormValues() {
  return {
    address: '',
    packages: CLOUD_ENVIRONMENTS_PACKAGES,
    resources: CLOUD_ENVIRONMENTS_RESOURCES,
    label: CLOUD_ENVIRONMENTS_LABELS,
    admin: CLOUD_ENVIRONMENTS_ADMINS,
    backup: false,
  }
}
