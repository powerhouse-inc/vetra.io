import { Plus } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/modules/shared/components/ui/button'

export function NewEnvironmentButton() {
  return (
    <Button asChild>
      <Link href="/user/environments/new">
        <Plus className="mr-2 h-4 w-4" />
        Create Environment
      </Link>
    </Button>
  )
}
