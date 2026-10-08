import { Ticket } from 'lucide-react'
import { RedeemCodeForm } from '@/modules/subscriptions/components/redeem/redeem-code-form'

export const metadata = { title: 'Redeem a code · Vetra' }

export default function RedeemPage() {
  return (
    <main className="mx-auto mt-24 max-w-xl px-4 py-10 sm:px-6">
      <div className="bg-card border-border space-y-6 rounded-2xl border p-6 shadow-sm sm:p-8">
        <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
          <Ticket className="h-5 w-5" aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Redeem an invite code</h1>
          <p className="text-muted-foreground text-sm">
            Got a code from an app or an event? Enter it to see what it gives you.
          </p>
        </div>
        <RedeemCodeForm />
      </div>
    </main>
  )
}
