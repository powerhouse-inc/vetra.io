# Scroll Reveal Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtle fade-up scroll reveal animations to all 11 sections of the Vetra landing page, with staggered children on the 4 sections that have 3+ cards.

**Architecture:** A shared `ScrollReveal` client component wraps any section and triggers a fade-up via Framer Motion's `whileInView`. An optional `stagger` prop turns it into a stagger container, and `ScrollRevealItem` wraps individual cards to cascade in with 80ms delays. Page sections remain server components throughout.

**Tech Stack:** Framer Motion v12 (`framer-motion`), Next.js App Router, React, TypeScript

---

## File Map

| File                                             | Action     | Purpose                                               |
| ------------------------------------------------ | ---------- | ----------------------------------------------------- |
| `modules/shared/components/ui/scroll-reveal.tsx` | **Create** | `ScrollReveal` + `ScrollRevealItem` components        |
| `modules/home/components/trust-bar.tsx`          | Modify     | Wrap section in `<ScrollReveal>`                      |
| `modules/home/components/features-tabs.tsx`      | Modify     | Wrap section in `<ScrollReveal>`                      |
| `modules/home/components/package-cta.tsx`        | Modify     | Wrap section in `<ScrollReveal>`                      |
| `modules/home/components/cloud-cta.tsx`          | Modify     | Wrap section in `<ScrollReveal>`                      |
| `modules/home/components/spec-to-scale.tsx`      | Modify     | Wrap section in `<ScrollReveal>`                      |
| `modules/home/components/waitlist-signup.tsx`    | Modify     | Wrap section in `<ScrollReveal>`                      |
| `modules/home/components/faq-section.tsx`        | Modify     | Wrap section in `<ScrollReveal>`                      |
| `modules/home/components/why-vetra.tsx`          | Modify     | Stagger wrapper + `ScrollRevealItem` on 3 cards       |
| `modules/home/components/audience-cards.tsx`     | Modify     | Stagger wrapper + `ScrollRevealItem` on 3 cards       |
| `modules/home/components/feature-showcase.tsx`   | Modify     | Stagger wrapper + `ScrollRevealItem` on 5 features    |
| `modules/home/components/powerhouse-stack.tsx`   | Modify     | Stagger wrapper + `ScrollRevealItem` on 3 columns     |
| `tests/scroll-reveal.spec.ts`                    | **Create** | Playwright smoke test — sections visible after scroll |

---

## Task 1: Create the `ScrollReveal` component

**Files:**

- Create: `modules/shared/components/ui/scroll-reveal.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { motion } from 'framer-motion'

const fadeUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

const staggerContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  stagger?: boolean
}

export function ScrollReveal({ children, className, stagger = false }: ScrollRevealProps) {
  return (
    <motion.div
      className={className}
      variants={stagger ? staggerContainerVariants : fadeUpVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
    >
      {children}
    </motion.div>
  )
}

export function ScrollRevealItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={fadeUpVariants}>
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
npm run tsc -- --noEmit
```

Expected: no errors related to `scroll-reveal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add modules/shared/components/ui/scroll-reveal.tsx
git commit -m "feat: add ScrollReveal and ScrollRevealItem components"
```

---

## Task 2: Apply whole-section wrapper to 7 simple sections

**Files:**

- Modify: `modules/home/components/trust-bar.tsx`
- Modify: `modules/home/components/features-tabs.tsx`
- Modify: `modules/home/components/package-cta.tsx`
- Modify: `modules/home/components/cloud-cta.tsx`
- Modify: `modules/home/components/spec-to-scale.tsx`
- Modify: `modules/home/components/waitlist-signup.tsx`
- Modify: `modules/home/components/faq-section.tsx`

The pattern is identical for all 7: add the import, wrap the outermost returned element in `<ScrollReveal>`.

- [ ] **Step 1: Update `trust-bar.tsx`**

```tsx
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

export function TrustBar() {
  return (
    <ScrollReveal>
      <section>
        <div className="mx-auto max-w-screen-xl px-6 py-12 text-center">
          <div className="flex items-center justify-center gap-12">{/* Logos removed */}</div>
        </div>
      </section>
    </ScrollReveal>
  )
}
```

- [ ] **Step 2: Update `features-tabs.tsx`**

Add the import at the top of the file, then wrap the return value:

```tsx
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

// inside FeaturesTabs():
return (
  <ScrollReveal>
    <section className="mx-auto max-w-screen-xl px-[74px] pt-8 pb-20">
      {/* existing content unchanged */}
    </section>
  </ScrollReveal>
)
```

- [ ] **Step 3: Update `package-cta.tsx`**

```tsx
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

// inside PackageCta():
return (
  <ScrollReveal>
    <section className="mx-auto max-w-screen-xl px-6 py-20">
      {/* existing content unchanged */}
    </section>
  </ScrollReveal>
)
```

- [ ] **Step 4: Update `cloud-cta.tsx`**

```tsx
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

// inside CloudCta():
return (
  <ScrollReveal>
    <section className="mx-auto max-w-screen-xl px-6 py-20">
      {/* existing content unchanged */}
    </section>
  </ScrollReveal>
)
```

- [ ] **Step 5: Update `spec-to-scale.tsx`**

```tsx
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

// inside SpecToScale():
return (
  <ScrollReveal>
    <section className="mx-auto max-w-screen-xl px-6 py-20">
      {/* existing content unchanged */}
    </section>
  </ScrollReveal>
)
```

- [ ] **Step 6: Update `waitlist-signup.tsx`**

```tsx
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

// inside WaitlistSignup():
return (
  <ScrollReveal>
    <section className="text-foreground relative">{/* existing content unchanged */}</section>
  </ScrollReveal>
)
```

- [ ] **Step 7: Update `faq-section.tsx`**

`faq-section.tsx` already has `'use client'` at the top — keep it. Add the import and wrap:

```tsx
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

// inside FaqSection():
return (
  <ScrollReveal>
    <section className="mx-auto max-w-screen-xl px-6 py-20">
      {/* existing content unchanged */}
    </section>
  </ScrollReveal>
)
```

- [ ] **Step 8: Check TypeScript**

```bash
npm run tsc -- --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add modules/home/components/trust-bar.tsx \
        modules/home/components/features-tabs.tsx \
        modules/home/components/package-cta.tsx \
        modules/home/components/cloud-cta.tsx \
        modules/home/components/spec-to-scale.tsx \
        modules/home/components/waitlist-signup.tsx \
        modules/home/components/faq-section.tsx
git commit -m "feat(animations): add scroll reveal to whole-section components"
```

---

## Task 3: Stagger — `WhyVetra` (3 differentiator cards)

**Files:**

- Modify: `modules/home/components/why-vetra.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'
```

- [ ] **Step 2: Wrap the outermost `<section>` in `<ScrollReveal stagger>` and each differentiator card in `<ScrollRevealItem>`**

```tsx
export function WhyVetra() {
  return (
    <ScrollReveal stagger>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-foreground mb-4 text-3xl font-bold">Yours to run. Yours to own.</h2>
          <p className="text-foreground-70 mt-2 text-2xl">
            Most AI builders generate code and host it for you.
            <br />
            Vetra gives you the platform itself.
          </p>
        </div>

        {/* Three differentiator cards */}
        <div className="mb-16 grid gap-6 lg:grid-cols-3">
          {differentiators.map((item) => (
            <ScrollRevealItem key={item.title}>
              <div className="border-border rounded-xl border p-6">
                <h3 className="text-foreground mb-3 text-lg font-bold">{item.title}</h3>
                <p className="text-foreground-70 text-sm leading-relaxed">{item.description}</p>
              </div>
            </ScrollRevealItem>
          ))}
        </div>

        {/* Comparison table — leave every line of existing markup exactly as-is */}
        <div className="border-border overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="bg-accent/50">
                <th className="text-foreground px-6 py-4 text-left text-sm font-semibold">
                  Feature
                </th>
                <th className="text-foreground-70 px-6 py-4 text-center text-sm font-semibold">
                  Other AI builders
                </th>
                <th className="text-foreground px-6 py-4 text-center text-sm font-semibold">
                  Vetra
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={row.feature} className={i % 2 === 0 ? 'bg-background' : 'bg-accent/20'}>
                  <td className="text-foreground px-6 py-3.5 text-sm">{row.feature}</td>
                  <td className="px-6 py-3.5 text-center">
                    {row.others ? (
                      <Check className="text-primary mx-auto h-4 w-4" />
                    ) : (
                      <X className="text-foreground-30 mx-auto h-4 w-4" />
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {row.vetra ? (
                      <Check className="text-primary mx-auto h-4 w-4" />
                    ) : (
                      <X className="text-foreground-30 mx-auto h-4 w-4" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ScrollReveal>
  )
}
```

Note: Only the differentiator cards get `<ScrollRevealItem>`. The comparison table and heading stay as-is.

- [ ] **Step 3: Check TypeScript**

```bash
npm run tsc -- --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add modules/home/components/why-vetra.tsx
git commit -m "feat(animations): stagger scroll reveal on WhyVetra cards"
```

---

## Task 4: Stagger — `AudienceCards` (3 cards)

**Files:**

- Modify: `modules/home/components/audience-cards.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'
```

- [ ] **Step 2: Wrap section and each card**

```tsx
export function AudienceCards() {
  return (
    <ScrollReveal stagger>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
        <h2 className="text-foreground mb-4 text-center text-3xl font-bold">Who it&apos;s for</h2>
        <p className="text-foreground-70 mt-2 mb-8 text-center text-2xl transition-all duration-500 ease-out">
          Vetra works for everyone — no technical background needed.
        </p>

        <div className="grid gap-6 lg:grid-cols-3">
          {audiences.map((audience) => (
            <ScrollRevealItem key={audience.title}>
              <Card>
                <CardHeader className="p-4">
                  <div className="flex items-center gap-3">
                    <AnimatedVetraLogo size={32} variant={audience.animation} className="h-8 w-8" />
                    <CardTitle>{audience.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-foreground-70 text-sm leading-relaxed">
                    {audience.description}
                  </p>
                </CardContent>
              </Card>
            </ScrollRevealItem>
          ))}
        </div>
      </section>
    </ScrollReveal>
  )
}
```

- [ ] **Step 3: Check TypeScript**

```bash
npm run tsc -- --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add modules/home/components/audience-cards.tsx
git commit -m "feat(animations): stagger scroll reveal on AudienceCards"
```

---

## Task 5: Stagger — `FeatureShowcase` (5 features)

**Files:**

- Modify: `modules/home/components/feature-showcase.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'
```

- [ ] **Step 2: Wrap section and each feature row**

```tsx
export function FeatureShowcase() {
  return (
    <ScrollReveal stagger>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
        <h2 className="text-foreground mb-16 text-center text-3xl font-bold">
          See what your team can do
        </h2>

        <div className="space-y-20">
          {features.map((feature, i) => (
            <ScrollRevealItem key={feature.title}>
              <div
                className={`flex flex-col items-center gap-10 md:flex-row ${
                  i % 2 === 0 ? 'md:flex-row-reverse' : ''
                }`}
              >
                <div className="flex-1">
                  <h3 className="text-foreground mb-4 text-2xl font-bold">{feature.title}</h3>
                  <p className="text-foreground-70 leading-relaxed">{feature.description}</p>
                </div>
                <div className="flex-1 overflow-hidden rounded-xl">
                  {'lottie' in feature && feature.lottie ? (
                    <DotLottiePlayer src={feature.lottie} className="h-[400px] w-full" />
                  ) : feature.image ? (
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      width={600}
                      height={400}
                      className="h-auto w-full object-cover"
                    />
                  ) : null}
                </div>
              </div>
            </ScrollRevealItem>
          ))}
        </div>
      </section>
    </ScrollReveal>
  )
}
```

- [ ] **Step 3: Check TypeScript**

```bash
npm run tsc -- --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add modules/home/components/feature-showcase.tsx
git commit -m "feat(animations): stagger scroll reveal on FeatureShowcase"
```

---

## Task 6: Stagger — `PowerhouseStack` (3 columns)

**Files:**

- Modify: `modules/home/components/powerhouse-stack.tsx`

The three stagger items are `<AchraCard />`, the Powerhouse centre card `<div>`, and `<VetraCard />`. Wrap each in `<ScrollRevealItem>` inside the grid, and wrap the `<section>` in `<ScrollReveal stagger>`.

- [ ] **Step 1: Add import to `powerhouse-stack.tsx`**

```tsx
import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'
```

- [ ] **Step 2: Wrap in `LayoutA`**

In the `LayoutA` function, wrap the `<section>` in `<ScrollReveal stagger>` and each of the three grid children in `<ScrollRevealItem>`:

```tsx
function LayoutA() {
  return (
    <ScrollReveal stagger>
      <section>
        <div className="mx-auto max-w-screen-xl px-6 py-20">
          <SectionHeader />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ScrollRevealItem>
              <AchraCard />
            </ScrollRevealItem>

            <ScrollRevealItem>
              {/* Powerhouse centre card — existing markup unchanged */}
              <div className="relative flex flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900">
                {/* ... all existing inner content ... */}
              </div>
            </ScrollRevealItem>

            <ScrollRevealItem>
              <VetraCard />
            </ScrollRevealItem>
          </div>
        </div>
      </section>
    </ScrollReveal>
  )
}
```

- [ ] **Step 3: Check TypeScript**

```bash
npm run tsc -- --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add modules/home/components/powerhouse-stack.tsx
git commit -m "feat(animations): stagger scroll reveal on PowerhouseStack columns"
```

---

## Task 7: Playwright smoke test

**Files:**

- Create: `tests/scroll-reveal.spec.ts`

- [ ] **Step 1: Start the dev server** (leave running in a separate terminal)

```bash
npm run dev
```

- [ ] **Step 2: Create the test file**

```ts
import { test, expect } from '@playwright/test'

test.describe('Scroll reveal animations', () => {
  test('sections become visible after scrolling into view', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Audience cards — stagger section
    const audienceSection = page.locator('section').filter({ hasText: "Who it's for" })
    await audienceSection.scrollIntoViewIfNeeded()
    await expect(audienceSection).toBeVisible()

    // WhyVetra — stagger section
    const whyVetraSection = page.locator('section').filter({ hasText: 'Yours to run' })
    await whyVetraSection.scrollIntoViewIfNeeded()
    await expect(whyVetraSection).toBeVisible()

    // PowerhouseStack — stagger section
    const stackSection = page.locator('section').filter({ hasText: 'Part of the Powerhouse Stack' })
    await stackSection.scrollIntoViewIfNeeded()
    await expect(stackSection).toBeVisible()

    // FAQ — whole-section
    const faqSection = page.locator('section').filter({ hasText: 'What can I do with Vetra' })
    await faqSection.scrollIntoViewIfNeeded()
    await expect(faqSection).toBeVisible()
  })
})
```

- [ ] **Step 3: Run the test**

```bash
npx playwright test tests/scroll-reveal.spec.ts
```

Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add tests/scroll-reveal.spec.ts
git commit -m "test: add scroll reveal Playwright smoke test"
```

---

## Visual verification checklist

After all tasks, run the dev server and manually verify:

- [ ] Each section fades up as it scrolls into view (not visible above fold sections stay static)
- [ ] AudienceCards: 3 cards cascade in left-to-right with visible stagger
- [ ] WhyVetra: 3 differentiator cards cascade in, comparison table appears together
- [ ] FeatureShowcase: feature rows appear one at a time as you scroll
- [ ] PowerhouseStack: 3 columns cascade in left-to-right
- [ ] Animations only play once (scrolling back up and down doesn't re-trigger)
- [ ] Dark mode: animations work identically
