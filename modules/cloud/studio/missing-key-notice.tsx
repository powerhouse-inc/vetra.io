import Link from 'next/link'
import { toast } from 'sonner'

export const MISSING_KEY_MESSAGE =
  "Your Studio is starting without a Claude key, so the agent can't answer yet. Add your Anthropic key under the environment's Secrets as ANTHROPIC_API_KEY."

/** Warns that a Studio was created without a Claude key, linking to its environment page. */
export function showMissingKeyNotice(documentId: string) {
  toast.warning(MISSING_KEY_MESSAGE, {
    duration: 15000,
    description: (
      <Link href={`/user/environments/${documentId}`} className="underline">
        Open environment
      </Link>
    ),
  })
}
