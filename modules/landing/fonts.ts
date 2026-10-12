import { Geist, JetBrains_Mono } from 'next/font/google'

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] })
const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

/** CSS variable classes for the console typefaces; apply on the console scope root. */
export const consoleFontVars = `${geist.variable} ${jetbrains.variable}`
