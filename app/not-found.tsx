import type { Metadata } from 'next'
import Link from 'next/link'
import { GoBackButton } from './_components/go-back-button'

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you were looking for does not exist or has moved.',
}

import { DISCORD_URL } from '@/modules/shared/config/constants'

export default function NotFound() {
  return (
    // pt clears the fixed 64px header so the large 404 is never tucked under it.
    <div className="flex flex-1 flex-col items-center justify-center px-6 pt-28 pb-12 text-center">
      {/* Large 404 */}
      <div className="text-primary mb-[-12px] font-mono text-[150px] leading-none font-bold tracking-[-6px] opacity-25 select-none max-sm:text-[96px] max-sm:tracking-[-3px]">
        404
      </div>

      {/* Heading */}
      <h1 className="text-foreground mb-3 text-[32px] font-bold tracking-[-0.03em] max-sm:text-2xl">
        Page not found
      </h1>
      <p className="text-muted-foreground mx-auto mb-8 max-w-[420px] text-base leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or has been moved. Head back to familiar
        ground.
      </p>

      {/* Buttons */}
      <div className="mb-14 flex gap-3 max-sm:w-full max-sm:max-w-[300px] max-sm:flex-col">
        <Link
          href="/"
          className="bg-primary text-primary-foreground inline-flex items-center justify-center rounded-lg px-8 py-3.5 text-base font-semibold transition-all hover:-translate-y-px hover:opacity-90"
        >
          Go Home
        </Link>
        <GoBackButton className="bg-accent text-foreground hover:bg-muted inline-flex items-center justify-center rounded-lg px-8 py-3.5 text-base font-semibold transition-all" />
      </div>

      {/* Quick Links */}
      <div className="mb-16 grid w-full max-w-[560px] grid-cols-4 gap-4 max-sm:grid-cols-2">
        <Link
          href="https://academy.vetra.io/"
          className="bg-card border-border hover:border-primary-30 flex flex-col items-center gap-2.5 rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="bg-muted border-border flex h-10 w-10 items-center justify-center rounded-[10px] border">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="text-foreground h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
          <span className="text-foreground text-[13px] font-semibold">Documentation</span>
        </Link>
        <Link
          href="/studio"
          className="bg-card border-border hover:border-primary-30 flex flex-col items-center gap-2.5 rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="bg-accent flex h-10 w-10 items-center justify-center rounded-[10px]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="text-foreground h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z"
              />
            </svg>
          </div>
          <span className="text-foreground text-[13px] font-semibold">Studio</span>
        </Link>
        <Link
          href="/cloud"
          className="bg-card border-border hover:border-primary-30 flex flex-col items-center gap-2.5 rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="bg-accent flex h-10 w-10 items-center justify-center rounded-[10px]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="text-foreground h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z"
              />
            </svg>
          </div>
          <span className="text-foreground text-[13px] font-semibold">Cloud</span>
        </Link>
        <Link
          href={DISCORD_URL}
          className="bg-card border-border hover:border-primary-30 flex flex-col items-center gap-2.5 rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="bg-accent flex h-10 w-10 items-center justify-center rounded-[10px]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="text-foreground h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <span className="text-foreground text-[13px] font-semibold">Contact</span>
        </Link>
      </div>
    </div>
  )
}
