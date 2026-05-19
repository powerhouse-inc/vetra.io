import { BookMeetingModal } from './book-meeting-modal'

export function CloudLandingCTA() {
  return (
    <section className="from-background to-muted/30 bg-gradient-to-b px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
          See Vetra Cloud in action
        </h2>
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
          Book a short demo and we&apos;ll show you how Vetra Cloud can run your team&apos;s
          workflows — managed or on your own infrastructure.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <BookMeetingModal />
          <p className="text-muted-foreground text-sm">
            or explore our{' '}
            <a href="#faq" className="text-primary hover:underline">
              frequently asked questions
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
