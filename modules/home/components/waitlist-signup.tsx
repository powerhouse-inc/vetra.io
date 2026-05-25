import { Button } from '@/modules/shared/components/ui/button'
import { GridBackground } from '@/modules/shared/components/ui/grid-background'
import { Input } from '@/modules/shared/components/ui/input'
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

export function WaitlistSignup() {
  return (
    <ScrollReveal>
      <section className="text-foreground relative">
      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0">
        <GridBackground
          squareSize={30}
          strokeWidth={1}
          strokeColor="#04c161"
          topFadeDistance={0}
          topFadeIntensity={0}
          bottomFadeDistance={0}
          bottomFadeIntensity={0}
          leftFadeDistance={0}
          leftFadeIntensity={0}
          rightFadeDistance={0}
          rightFadeIntensity={0}
          className="absolute inset-0 opacity-75"
        />
        {/* CSS-based fade overlay */}
        <div className="from-background to-background absolute inset-0 bg-gradient-to-b via-transparent opacity-100"></div>
      </div>
      <div className="relative z-10 mx-auto max-w-screen-xl px-6 py-20 text-center">
        <h2 className="mb-4 text-3xl font-bold">Stay in the loop</h2>
        <p className="text-foreground-70 mt-2 mb-8 text-2xl transition-all duration-500 ease-out">
          Be the first to know about new features. <br /> No spam, unsubscribe any time.
        </p>

        <form
          action="https://gmail.us21.list-manage.com/subscribe/post?u=a65ca7e437961008f5f5c1bad&id=c8ea339c46&f_id=00fda7e6f0"
          method="post"
          target="_blank"
          className="mx-auto flex max-w-md items-center justify-center gap-3"
        >
          <Input
            type="email"
            name="EMAIL"
            placeholder="you@example.com"
            required
            className="border-border bg-background text-foreground placeholder:text-foreground/60 flex-1"
          />
          <Button type="submit" variant="default" size="lg">
            Subscribe
          </Button>
        </form>
      </div>
    </section>
    </ScrollReveal>
  )
}
