# Scroll Reveal Animations — Design Spec

**Date:** 2026-05-25
**Status:** Approved

## Summary

Add on-scroll fade-up reveal animations to all sections of the Vetra landing page. Sections with 3 or more cards/children stagger their children in; all other sections animate as a single unit.

## Animation Feel

Subtle & Professional — barely noticed but missed when removed.

| Parameter          | Value                         |
| ------------------ | ----------------------------- |
| Initial opacity    | 0                             |
| Final opacity      | 1                             |
| Y offset (initial) | 20px                          |
| Duration           | 400ms                         |
| Easing             | easeOut                       |
| Stagger delay      | 80ms between children         |
| Viewport trigger   | `once: true`, `margin: -50px` |

## Shared Component

**File:** `modules/shared/components/ui/scroll-reveal.tsx`

Two exports:

### `<ScrollReveal>`

Wraps any section element. Default behaviour: animates the whole block as one unit (fade-up). With the `stagger` prop: becomes a stagger container — triggers children to cascade in with 80ms delay between each. Must be a `'use client'` component; page sections remain server components.

**Props:**

- `children: React.ReactNode`
- `className?: string`
- `stagger?: boolean` — enables stagger container mode (default: false)

### `<ScrollRevealItem>`

A `motion.div` that picks up stagger variants from a `<ScrollReveal stagger>` parent. No props required beyond `children` and optional `className`. Only used inside a `<ScrollReveal stagger>` parent.

## Section Treatment

| Section         | Treatment                | Reason                               |
| --------------- | ------------------------ | ------------------------------------ |
| TrustBar        | `<ScrollReveal>` whole   | Simple logo row                      |
| FeaturesTabs    | `<ScrollReveal>` whole   | Tab UI, too interactive to stagger   |
| WhyVetra        | `<ScrollReveal stagger>` | 3 differentiator cards in grid       |
| AudienceCards   | `<ScrollReveal stagger>` | 3 audience cards in grid             |
| FeatureShowcase | `<ScrollReveal stagger>` | 5 feature items                      |
| PackageCta      | `<ScrollReveal>` whole   | Single CTA block                     |
| CloudCta        | `<ScrollReveal>` whole   | Single CTA block                     |
| PowerhouseStack | `<ScrollReveal stagger>` | 3 columns (Achra, Powerhouse, Vetra) |
| SpecToScale     | `<ScrollReveal>` whole   | No repeated card pattern             |
| WaitlistSignup  | `<ScrollReveal>` whole   | Single form block                    |
| FaqSection      | `<ScrollReveal>` whole   | Accordion, not cards                 |

Hero is excluded — it is above the fold and always visible on load.

## File Changes

**New file (1):**

- `modules/shared/components/ui/scroll-reveal.tsx`

**Whole-section wrappers (7 files):**

- `modules/home/components/trust-bar.tsx`
- `modules/home/components/features-tabs.tsx`
- `modules/home/components/package-cta.tsx`
- `modules/home/components/cloud-cta.tsx`
- `modules/home/components/spec-to-scale.tsx`
- `modules/home/components/waitlist-signup.tsx`
- `modules/home/components/faq-section.tsx`

**Stagger wrappers (4 files):**

- `modules/home/components/why-vetra.tsx` — wrap each item in `differentiators.map()`
- `modules/home/components/audience-cards.tsx` — wrap each item in `audiences.map()`
- `modules/home/components/feature-showcase.tsx` — wrap each item in `features.map()`
- `modules/home/components/powerhouse-stack.tsx` — wrap `<AchraCard>`, Powerhouse centre card div, and `<VetraCard>`

`app/(home)/page.tsx` is not modified.

## Out of Scope

- Hero section animations
- Hover/interaction animations
- Animated counters or number reveals
- Page transition animations
