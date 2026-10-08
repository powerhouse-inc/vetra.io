import { toast } from 'sonner'
import { describePublisherError } from '../graphql'

/** Runs a write; success toasts `ok`, failure toasts the friendly copy for the server's error code. */
export async function runWithToast(fn: () => Promise<unknown>, ok: string): Promise<boolean> {
  try {
    await fn()
    toast.success(ok)
    return true
  } catch (err) {
    toast.error(describePublisherError(err))
    return false
  }
}
